import {
  SemanticParser,
  ManifestValidator,
  PolicyEngine,
  ExecutionLogger,
  coerceArgs,
  getPageForAction,
  type AgentManifest,
  type ActionCatalog,
  type ExecutionResult,
} from '@agent-accessibility-framework/runtime-core';
import { WidgetPlanner } from './widget-planner.js';
import { readConfig, detectAvailableBackend } from './config.js';
import { ChatUI } from './ui/chat.js';
import { showConfirmation } from './ui/confirmation.js';
import { buildSiteActions, buildSiteDataViews, buildPageSummaries, persistNavigation, checkPendingNavigation } from './navigation.js';

const MANIFEST_PATH = '/.well-known/agent-manifest.json';

/** Scrape visible semantic data (collections, items) into a text string for LLM context */
function scrapePageData(): string {
  const collections = document.querySelectorAll('[data-agent-kind="collection"]');
  if (collections.length === 0) return '';

  const lines: string[] = [];

  for (const collection of collections) {
    const label = collection.getAttribute('data-agent-action') || 'data';
    lines.push(`[${label}]`);

    // Check for table structure
    const rows = collection.querySelectorAll('tr[data-agent-kind="item"]');
    if (rows.length > 0) {
      // Extract header row if present
      const headers = collection.querySelectorAll('thead th');
      const headerNames = Array.from(headers).map((th) => th.textContent?.trim() || '');

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        const cellTexts = Array.from(cells).map((td) => td.textContent?.trim() || '');
        if (headerNames.length === cellTexts.length) {
          const pairs = headerNames.map((h, i) => `${h}: ${cellTexts[i]}`);
          lines.push(pairs.join(', '));
        } else {
          lines.push(cellTexts.join(' | '));
        }
      }
    } else {
      // Non-table items
      const items = collection.querySelectorAll('[data-agent-kind="item"]');
      for (const item of items) {
        lines.push(item.textContent?.trim() || '');
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

/** Fetch the agent manifest from the current origin */
async function fetchManifest(): Promise<AgentManifest | null> {
  try {
    const url = `${window.location.origin}${MANIFEST_PATH}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fill fields, click submit, read status — same logic as DomAdapter.execute() */
async function executeOnDOM(
  actionName: string,
  args: Record<string, unknown>,
  confirmed: boolean,
  manifest: AgentManifest,
): Promise<ExecutionResult> {
  const validator = new ManifestValidator();
  const policy = new PolicyEngine();
  const parser = new SemanticParser();
  const logger = new ExecutionLogger(actionName, 'ui');

  try {
    const action = validator.getAction(manifest, actionName);

    // Policy check
    const policyResult = policy.checkExecution(action, { confirmed, requiredFields: args });
    if (!policyResult.allowed) {
      logger.policyCheck('BLOCKED', policyResult.reason);

      if (action.risk === 'high' && action.confirmation === 'required' && !confirmed) {
        return {
          status: 'needs_confirmation',
          log: logger.toLog(),
          confirmation_metadata: {
            action: actionName,
            risk: action.risk,
            scope: action.scope,
            title: action.title,
          },
        };
      }

      return { status: 'execution_error', error: policyResult.reason, log: logger.toLog() };
    }
    logger.policyCheck('PASSED');

    // Coerce args to match schema types
    const { args: coercedArgs, coercions } = coerceArgs(args, action.inputSchema);
    logger.coerce(coercions);

    // Validate coerced input
    const validation = validator.validateInput(action, coercedArgs);
    if (!validation.valid) {
      logger.validate(`FAILED: ${validation.errors.join(', ')}`);
      return { status: 'validation_error', error: validation.errors.join(', '), log: logger.toLog() };
    }
    logger.validate('PASSED');

    // Discover the action element on the page
    const actions = parser.discoverActions(document.body);
    const discovered = actions.find((a) => a.action === actionName);
    if (!discovered) {
      return { status: 'execution_error', error: `Action "${actionName}" not found on page`, log: logger.toLog() };
    }

    const actionRoot = document.querySelector(
      `[data-agent-kind="action"][data-agent-action="${actionName}"]`,
    );
    const findFieldElement = (fieldName: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null => {
      const escaped = (window.CSS && typeof window.CSS.escape === 'function')
        ? window.CSS.escape(fieldName)
        : fieldName;
      const nested = actionRoot?.querySelector(
        `[data-agent-kind="field"][data-agent-field="${escaped}"]`,
      ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (nested) return nested;
      return document.querySelector(
        `[data-agent-kind="field"][data-agent-field="${escaped}"][data-agent-for-action="${actionName}"]`,
      ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    };
    const findStatusElement = (): Element | null => {
      const nested = actionRoot?.querySelector('[data-agent-kind="status"]');
      if (nested) return nested;
      return document.querySelector(`[data-agent-kind="status"][data-agent-for-action="${actionName}"]`);
    };

    // Fill fields using native value setter + event dispatch
    for (const field of discovered.fields) {
      const value = coercedArgs[field.field];
      if (value === undefined) continue;

      const el = findFieldElement(field.field);
      if (!el) continue;

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value',
      )?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value',
      )?.set;

      const tagName = el.tagName.toLowerCase();
      if (tagName === 'select') {
        (el as HTMLSelectElement).value = String(value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tagName === 'textarea' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      logger.fill(field.field, value);
    }

    // If confirmation is 'review', stop after filling — let the user submit manually
    if (action.confirmation === 'review') {
      return { status: 'awaiting_review', log: logger.toLog() };
    }

    // Click submit
    const submitSelector = discovered.submitAction
      ? `[data-agent-action="${discovered.submitAction}"]`
      : `[data-agent-action="${actionName}"]`;
    const submitEl = document.querySelector(submitSelector) as HTMLElement | null;
    if (submitEl) {
      submitEl.click();
      logger.click(discovered.submitAction || actionName);
    }

    // Wait for status update
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Read status
    const statusEl = findStatusElement();
    const statusText = statusEl?.textContent?.trim() || '';
    if (statusText) {
      const outputAttr = statusEl?.getAttribute('data-agent-output') || '';
      logger.readStatus(outputAttr, statusText);
    }

    return { status: 'completed', result: statusText, log: logger.toLog() };
  } catch (err) {
    return { status: 'execution_error', error: (err as Error).message, log: logger.toLog() };
  }
}

/** Boot the AAF agent widget */
async function init(): Promise<void> {
  // Check for pending cross-page navigation BEFORE the bail-out so it isn't lost
  const pendingNav = checkPendingNavigation();

  const hasAAFElements = document.querySelectorAll('[data-agent-kind]').length > 0;
  if (!hasAAFElements && !pendingNav) return;

  const parser = new SemanticParser();
  let manifest: AgentManifest | null = null;
  let hasNavigatedThisSession = false;
  let isNavigationResend = false;

  // Conversation memory — tracks last plan + recent exchanges for follow-ups
  interface ConversationTurn { role: 'user' | 'assistant' | 'error'; text: string }
  const history: ConversationTurn[] = [];
  let lastPlan: { action: string; args: Record<string, unknown> } | null = null;
  let pendingReview: { action: string; args: Record<string, unknown> } | null = null;

  const chat = new ChatUI({
    onSubmit: (text) => handleUserMessage(text),
  });

  chat.mount();

  // Detect backend via config, then availability check
  const config = readConfig();
  const backend = await detectAvailableBackend(config);
  if (!backend) {
    chat.setBadge('inspect only', false);
    chat.addMessage('system', 'No LLM backend detected. Install Ollama (https://ollama.com) and pull a model to enable chat.');
    showInspector();
    return;
  }
  const planner = new WidgetPlanner(backend);
  chat.setBadge(backend.name(), true);

  // Load manifest
  manifest = await fetchManifest();

  // Restore pending cross-page navigation
  if (pendingNav) {
    hasNavigatedThisSession = true;

    // Restore conversation history into UI (for visual context)
    for (const turn of pendingNav.conversationHistory) {
      history.push({ role: turn.role as ConversationTurn['role'], text: turn.text });
      chat.addMessage(turn.role as 'user' | 'assistant' | 'system' | 'error', turn.text);
    }

    chat.open();
    chat.addMessage('system', `Navigated to ${pendingNav.targetPage}`);

    if (pendingNav.navigateOnly) {
      // Navigation was the goal — don't re-plan. Just show the page.
      chat.setEnabled(true);
    } else {
      // Re-send the original user message to plan against the new page.
      // Flag prevents handleUserMessage from re-adding the user message to chat/history.
      isNavigationResend = true;
      handleUserMessage(pendingNav.userMessage);
    }
  }

  /** Click submit on an already-filled form (after user confirms a pending review) */
  async function submitPendingAction(actionName: string): Promise<ExecutionResult> {
    const logger = new ExecutionLogger(actionName, 'ui');

    const actions = parser.discoverActions(document.body);
    const discovered = actions.find((a) => a.action === actionName);
    if (!discovered) {
      return { status: 'execution_error', error: `Action "${actionName}" not found on page`, log: logger.toLog() };
    }

    const actionRoot = document.querySelector(
      `[data-agent-kind="action"][data-agent-action="${actionName}"]`,
    );
    const findStatusElement = (): Element | null => {
      const nested = actionRoot?.querySelector('[data-agent-kind="status"]');
      if (nested) return nested;
      return document.querySelector(`[data-agent-kind="status"][data-agent-for-action="${actionName}"]`);
    };

    const submitSelector = discovered.submitAction
      ? `[data-agent-action="${discovered.submitAction}"]`
      : `[data-agent-action="${actionName}"]`;
    const submitEl = document.querySelector(submitSelector) as HTMLElement | null;
    if (submitEl) {
      submitEl.click();
      logger.click(discovered.submitAction || actionName);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const statusEl = findStatusElement();
    const statusText = statusEl?.textContent?.trim() || '';
    if (statusText) {
      const outputAttr = statusEl?.getAttribute('data-agent-output') || '';
      logger.readStatus(outputAttr, statusText);
    }

    return { status: 'completed', result: statusText, log: logger.toLog() };
  }

  async function handleUserMessage(text: string): Promise<void> {
    // Skip adding user message when re-sending after navigation (already restored from history)
    if (!isNavigationResend) {
      chat.addMessage('user', text);
      history.push({ role: 'user', text });
    }
    isNavigationResend = false;
    chat.setEnabled(false);

    try {
      // Discover actions on current page
      const catalog: ActionCatalog = {
        actions: parser.discoverActions(document.body),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      // Build off-page actions, queryable data views, and navigable page summaries from manifest
      const currentActionNames = catalog.actions.map((a) => a.action);
      const otherPageActions = manifest
        ? buildSiteActions(manifest, currentActionNames)
        : [];
      const pageSummaries = manifest
        ? buildPageSummaries(manifest, window.location.pathname)
        : [];
      const dataViews = manifest
        ? buildSiteDataViews(manifest)
        : [];
      // Discover links visible on the current page (supplements manifest pages with actual hrefs)
      const discoveredLinks = parser.discoverLinks(document.body);

      const hasSiteContext = otherPageActions.length > 0 || pageSummaries.length > 0 || dataViews.length > 0 || discoveredLinks.length > 0;

      if (catalog.actions.length === 0 && !hasSiteContext) {
        // No actions anywhere and no pages to navigate to — try data chat mode
        const pageData = scrapePageData();
        if (pageData) {
          chat.addMessage('system', 'Answering from page data...');
          const answer = await planner.query(text, pageData);
          chat.addMessage('assistant', answer);
          history.push({ role: 'assistant', text: answer });
          chat.setEnabled(true);
          return;
        }
        chat.addMessage('system', 'No actions or data found on this page.');
        chat.setEnabled(true);
        return;
      }

      // Scrape page data for context (collections, items, tables)
      const pageData = scrapePageData() || undefined;

      // Build contextual prompt with conversation history
      const contextualMessage = buildContextualMessage(text);

      // Plan — use site-aware prompt when off-page context exists
      chat.addMessage('system', 'Planning...');
      const planResult = hasSiteContext
        ? await planner.planSiteAware(contextualMessage, catalog, otherPageActions, pageSummaries, pageData, dataViews, discoveredLinks)
        : await planner.plan(contextualMessage, catalog, pageData);

      // Handle navigation-only responses (route already validated by parseResponse)
      if (planResult.kind === 'navigate') {
        chat.addMessage('system', `Navigating to ${planResult.page}...`);
        persistNavigation(planResult.page, text, history, true);
        window.location.href = planResult.page;
        return;
      }

      // Handle informational answers (no action to execute)
      if (planResult.kind === 'answer') {
        chat.addMessage('system', 'Answering from page data...');
        chat.addMessage('assistant', planResult.text);
        history.push({ role: 'assistant', text: planResult.text });
        chat.setEnabled(true);
        return;
      }

      const request = planResult.request;

      // Check if the planned action is actually a queryable data view
      if (manifest?.data?.[request.action] && manifest.data[request.action].inputSchema) {
        const dv = manifest.data[request.action];
        // Find the page for this data view
        let dvPage: string | undefined;
        if (manifest.pages) {
          for (const [route, page] of Object.entries(manifest.pages)) {
            if (page.data?.includes(request.action)) {
              dvPage = route;
              break;
            }
          }
        }
        if (dvPage) {
          // Build URL with query params from args
          const url = new URL(dvPage, window.location.origin);
          for (const [key, value] of Object.entries(request.args)) {
            if (value !== undefined && value !== null) {
              url.searchParams.set(key, String(value));
            }
          }
          chat.addMessage('system', `Querying ${dv.title}...`);
          persistNavigation(url.pathname + url.search, text, history, false);
          window.location.href = url.pathname + url.search;
          return;
        }
      }

      // Check if this is a confirmation of a pending review
      if (pendingReview && request.confirmed && request.action === pendingReview.action) {
        chat.addMessage('system', 'Submitting...');
        const result = await submitPendingAction(request.action);
        pendingReview = null;
        lastPlan = null;

        if (result.status === 'completed') {
          const msg = result.result || 'Action completed successfully.';
          chat.addMessage('assistant', msg);
          history.push({ role: 'assistant', text: msg });
        } else {
          const msg = `${result.status}: ${result.error || 'Unknown error'}`;
          chat.addMessage('error', msg);
          history.push({ role: 'error', text: msg });
        }
        chat.setEnabled(true);
        return;
      }

      // New action planned — clear any stale pending review
      pendingReview = null;

      chat.addMessage('assistant', `Action: ${request.action}\nArgs: ${JSON.stringify(request.args, null, 2)}`);

      // Save plan for follow-up context
      lastPlan = { action: request.action, args: { ...request.args } };
      history.push({ role: 'assistant', text: `Planned: ${request.action} with ${JSON.stringify(request.args)}` });

      if (!manifest) {
        chat.addMessage('error', 'No manifest available — cannot execute.');
        chat.setEnabled(true);
        return;
      }

      // Check if the planned action is on the current page
      const isOnCurrentPage = catalog.actions.some((a) => a.action === request.action);

      if (!isOnCurrentPage) {
        // Cross-page navigation needed
        const targetPage = getPageForAction(manifest, request.action);
        if (!targetPage) {
          chat.addMessage('error', `Action "${request.action}" not mapped to any page in manifest.`);
          chat.setEnabled(true);
          return;
        }

        if (hasNavigatedThisSession) {
          // We already navigated this session. Check if we're on the correct page
          // but the action has no DOM element (safety net).
          const currentPath = window.location.pathname.replace(/\/$/, '');
          const normalizedTarget = targetPage.replace(/\/$/, '');
          if (currentPath === normalizedTarget) {
            // We're on the right page — this is a view/read action.
            // Serve page data as the result.
            const viewData = scrapePageData();
            if (viewData) {
              const answer = await planner.query(text, viewData);
              chat.addMessage('assistant', answer);
              history.push({ role: 'assistant', text: answer });
            } else {
              chat.addMessage('assistant', `Navigated to ${targetPage}. The requested content is now visible.`);
              history.push({ role: 'assistant', text: `Navigated to ${targetPage}` });
            }
            lastPlan = null;
            chat.setEnabled(true);
            return;
          }

          chat.addMessage('error', `Action "${request.action}" not found after navigation — aborting to prevent loop.`);
          chat.setEnabled(true);
          return;
        }

        chat.addMessage('system', `Navigating to ${targetPage}...`);
        persistNavigation(targetPage, text, history);
        window.location.href = targetPage;
        return;
      }

      // Execute (coercion happens inside executeOnDOM)
      let result = await executeOnDOM(request.action, request.args, request.confirmed || false, manifest);

      // Handle confirmation
      if (result.status === 'needs_confirmation' && result.confirmation_metadata) {
        const confirmed = await showConfirmation(chat.shadow, result.confirmation_metadata);
        if (confirmed) {
          result = await executeOnDOM(request.action, request.args, true, manifest);
        } else {
          chat.addMessage('system', 'Action cancelled by user.');
          history.push({ role: 'assistant', text: 'Action cancelled by user.' });
          chat.setEnabled(true);
          return;
        }
      }

      // Display result
      if (result.status === 'awaiting_review') {
        const msg = 'Form filled — review and submit when ready, or say "submit" to send.';
        chat.addMessage('assistant', msg);
        history.push({ role: 'assistant', text: msg });
        pendingReview = { action: request.action, args: { ...request.args } };
        chat.setEnabled(true);
        return;
      }

      if (result.status === 'completed') {
        const msg = result.result || 'Action completed successfully.';
        chat.addMessage('assistant', msg);
        history.push({ role: 'assistant', text: msg });
        // Clear plan after successful execution
        lastPlan = null;
      } else {
        const msg = `${result.status}: ${result.error || 'Unknown error'}`;
        chat.addMessage('error', msg);
        history.push({ role: 'error', text: msg });
      }
    } catch (err) {
      const msg = (err as Error).message;
      chat.addMessage('error', msg);
      history.push({ role: 'error', text: msg });
    }

    chat.setEnabled(true);
  }

  /** Build a message that includes conversation context for follow-ups */
  function buildContextualMessage(text: string): string {
    // If there's a pending review, tell the LLM about the filled form
    if (pendingReview) {
      return `A form for action "${pendingReview.action}" has been filled with these values and is awaiting user review:\n${JSON.stringify(pendingReview.args, null, 2)}\n\nIf the user wants to submit/send/confirm the form as-is, respond with: {"action": "${pendingReview.action}", "args": ${JSON.stringify(pendingReview.args)}, "confirmed": true}\nIf the user wants to change something, respond with the updated action and args (without "confirmed").\n\nUser message: "${text}"`;
    }

    // If there's a previous plan (from a failed or incomplete attempt), include it
    if (lastPlan) {
      return `Previous plan: ${JSON.stringify(lastPlan)}\n\nThe user is providing a follow-up or correction. Merge the new information with the previous plan, keeping all fields from the previous plan that are not being changed.\n\nUser follow-up: "${text}"`;
    }

    // If there's recent conversation history, include a brief summary
    const recentTurns = history.slice(-4);
    if (recentTurns.length > 0) {
      const context = recentTurns
        .map((t) => `${t.role}: ${t.text}`)
        .join('\n');
      return `Recent conversation:\n${context}\n\nNew user request: "${text}"`;
    }

    return text;
  }

  function showInspector(): void {
    const actions = parser.discoverActions(document.body);
    if (actions.length === 0) {
      chat.addMessage('system', 'No AAF actions found on this page.');
      return;
    }

    for (const action of actions) {
      const fields = action.fields.map((f) => `  ${f.field} (${f.tagName})`).join('\n');
      const meta = [
        action.danger ? `risk: ${action.danger}` : '',
        action.confirm ? `confirm: ${action.confirm}` : '',
        action.scope ? `scope: ${action.scope}` : '',
      ].filter(Boolean).join(' | ');

      chat.addMessage('assistant', `${action.action}\n${meta}\nFields:\n${fields || '  (none)'}`);
    }
  }
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
