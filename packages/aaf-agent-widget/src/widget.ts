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
import { WidgetPlanner, PlannerError } from './widget-planner.js';
import { readConfig, detectAvailableBackend } from './config.js';
import { ChatUI } from './ui/chat.js';
import { showConfirmation } from './ui/confirmation.js';
import { buildSiteActions, buildSiteDataViews, buildPageSummaries, enrichCatalogWithSchema, persistNavigation, checkPendingNavigation } from './navigation.js';

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

/**
 * Wait for an action element to appear in the DOM.
 * SPA pages may still be hydrating, loading feature flags, or fetching data
 * when the widget starts — so the action element may not exist yet.
 * Returns the element if found within the timeout, or null.
 */
function waitForActionElement(actionName: string, timeoutMs: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const selector = `[data-agent-kind="action"][data-agent-action="${actionName}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

interface ExecuteOnDOMOptions {
  manifestOrigin?: string;
  agentScopes?: string[];
}

/** Fill fields, click submit, read status — same logic as DomAdapter.execute() */
async function executeOnDOM(
  actionName: string,
  args: Record<string, unknown>,
  confirmed: boolean,
  manifest: AgentManifest,
  securityOptions?: ExecuteOnDOMOptions,
): Promise<ExecutionResult> {
  const validator = new ManifestValidator();
  const policy = new PolicyEngine();
  const parser = new SemanticParser();
  const logger = new ExecutionLogger(actionName, 'ui');

  try {
    const action = validator.getAction(manifest, actionName);

    // Policy check — includes arg safety, origin trust, and scope enforcement
    const policyResult = policy.checkExecution(action, {
      confirmed,
      requiredFields: args,
      args,
      ...(securityOptions?.manifestOrigin
        ? { manifestOrigin: securityOptions.manifestOrigin, pageOrigin: window.location.origin }
        : {}),
      ...(securityOptions?.agentScopes ? { agentScopes: securityOptions.agentScopes } : {}),
    });
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
    const findFieldElement = (fieldName: string): Element | null => {
      const escaped = (window.CSS && typeof window.CSS.escape === 'function')
        ? window.CSS.escape(fieldName)
        : fieldName;
      const nested = actionRoot?.querySelector(
        `[data-agent-kind="field"][data-agent-field="${escaped}"]`,
      );
      if (nested) return nested;
      return document.querySelector(
        `[data-agent-kind="field"][data-agent-field="${escaped}"][data-agent-for-action="${actionName}"]`,
      );
    };

    /**
     * Resolve a field wrapper to the actual interactive element inside it.
     * Component libraries (HeroUI, Radix, etc.) wrap native elements in divs.
     * Skips hidden elements (aria-hidden, hidden attribute) since those are
     * decorative native elements that don't drive React state.
     */
    const resolveInteractiveElement = (el: Element): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        return el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      }
      // Look inside the wrapper for a VISIBLE native form element
      const candidates = el.querySelectorAll('select, input, textarea');
      for (const candidate of candidates) {
        const isHidden = candidate.getAttribute('aria-hidden') === 'true'
          || candidate.hasAttribute('hidden')
          || (candidate as HTMLElement).style.display === 'none'
          || candidate.classList.contains('hidden');
        if (!isHidden) {
          return candidate as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        }
      }
      return null;
    };

    /**
     * Simulate a realistic press on an element (pointerdown + pointerup + click).
     * React Aria's usePress requires pointer events with realistic properties
     * (pointerType, pointerId, button) to properly register the interaction.
     */
    const simulatePress = (el: HTMLElement): void => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const shared = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse' as const,
        clientX: cx,
        clientY: cy,
        button: 0,
        buttons: 1,
      };
      el.dispatchEvent(new PointerEvent('pointerdown', shared));
      el.dispatchEvent(new PointerEvent('pointerup', { ...shared, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: cx,
        clientY: cy,
        button: 0,
      }));
    };

    /**
     * Fill a component-library select (HeroUI, Radix, etc.) by clicking the trigger
     * and selecting the matching option from the opened listbox.
     */
    const fillComponentSelect = async (wrapper: Element, value: string): Promise<boolean> => {
      // Find the trigger button (HeroUI/React Aria pattern)
      const trigger = wrapper.querySelector('button[data-slot="trigger"], button[role="combobox"], button[aria-haspopup="listbox"]')
        || wrapper.querySelector('button');
      if (!trigger) return false;

      // Press to open the dropdown
      simulatePress(trigger as HTMLElement);
      // Wait for the listbox to render (may be in a portal)
      await new Promise((r) => setTimeout(r, 150));

      // Find the listbox (may be in a portal outside the wrapper)
      const listboxId = trigger.getAttribute('aria-controls');
      const listbox = listboxId
        ? document.getElementById(listboxId)
        : document.querySelector('[role="listbox"]');
      if (!listbox) {
        // Close the dropdown if we can't find the listbox
        simulatePress(trigger as HTMLElement);
        return false;
      }

      // Find the matching option by data-key, value, or text content
      const options = listbox.querySelectorAll('[role="option"]');
      let matched: HTMLElement | null = null;
      for (const opt of options) {
        const key = opt.getAttribute('data-key') || opt.getAttribute('data-value') || '';
        if (key === value) {
          matched = opt as HTMLElement;
          break;
        }
      }
      // Fallback: match by text content (case-insensitive)
      if (!matched) {
        for (const opt of options) {
          if (opt.textContent?.trim().toLowerCase() === value.toLowerCase()) {
            matched = opt as HTMLElement;
            break;
          }
        }
      }

      if (matched) {
        simulatePress(matched);
        await new Promise((r) => setTimeout(r, 50));
        return true;
      }

      // No match found — close the dropdown
      simulatePress(trigger as HTMLElement);
      return false;
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

      const wrapper = findFieldElement(field.field);
      if (!wrapper) continue;

      // Check for component-library select FIRST (HeroUI, Radix, etc.)
      // These wrap native elements in divs and use trigger+listbox patterns.
      // Setting a native input/select value inside them does NOT update React state.
      const hasComponentTrigger = wrapper.querySelector(
        'button[data-slot="trigger"], button[role="combobox"], button[aria-haspopup="listbox"]',
      );

      if (hasComponentTrigger) {
        await fillComponentSelect(wrapper, String(value));
      } else {
        const el = resolveInteractiveElement(wrapper);
        if (el) {
          const tagName = el.tagName.toLowerCase();
          const inputEl = el as HTMLInputElement;

          // Checkbox / switch — click to toggle instead of setting value.
          // HeroUI Switch renders a hidden checkbox with role="switch".
          // React ignores programmatic value changes on checkboxes; only
          // a click dispatches the synthetic onChange / onValueChange.
          if (tagName === 'input' && (inputEl.type === 'checkbox' || inputEl.getAttribute('role') === 'switch')) {
            const wantChecked = value === true || value === 'true' || value === '1';
            if (inputEl.checked !== wantChecked) {
              // Click the wrapper label / switch element (not the hidden input)
              // so React Aria / HeroUI picks up the interaction.
              const clickTarget = wrapper.querySelector('label, [data-slot="wrapper"], span[role="switch"]')
                || wrapper;
              simulatePress(clickTarget as HTMLElement);
              await new Promise((r) => setTimeout(r, 100));
            }
          } else if (tagName === 'select') {
            (el as HTMLSelectElement).value = String(value);
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            // Text input / textarea — use native setter approach
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value',
            )?.set;
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value',
            )?.set;

            if (tagName === 'textarea' && nativeTextAreaValueSetter) {
              nativeTextAreaValueSetter.call(el, String(value));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (nativeInputValueSetter) {
              nativeInputValueSetter.call(el, String(value));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      }

      logger.fill(field.field, value);
    }

    // If confirmation is 'review', stop after filling — let the user submit manually
    if (action.confirmation === 'review') {
      return { status: 'awaiting_review', log: logger.toLog() };
    }

    // Allow React to re-render after field fills (e.g. conditionally rendered submit buttons)
    await new Promise((resolve) => setTimeout(resolve, 200));

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
  let lastUserMessage = '';

  const chat = new ChatUI({
    onSubmit: (text) => handleUserMessage(text),
    onRetry: () => {
      if (lastUserMessage) {
        handleUserMessage(lastUserMessage);
      }
    },
    onModelChange: (model) => {
      if (backend?.setModel) {
        backend.setModel(model);
        const label = backend.currentModel ? backend.currentModel() : model;
        chat.setBadge(label, true);
        chat.addMessage('system', `Switched to model: ${model}`);
      }
    },
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
  const currentModel = backend.currentModel ? backend.currentModel() : '';
  chat.setBadge(currentModel || backend.name(), true);

  // Populate model selector if backend supports listing models
  if (backend.listModels) {
    backend.listModels().then((models) => {
      if (models.length > 0) {
        chat.setModels(models, currentModel);
      }
    });
  }

  // Load manifest
  manifest = await fetchManifest();

  // Security context for PolicyEngine checks
  const manifestOrigin = window.location.origin; // origin the manifest was fetched from
  const agentScopes = config.agentScopes;
  const securityOpts: ExecuteOnDOMOptions = {
    ...(manifestOrigin ? { manifestOrigin } : {}),
    ...(agentScopes ? { agentScopes } : {}),
  };

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
    } else if (pendingNav.plannedAction && manifest) {
      // We have a pre-planned action from before navigation — wait for the
      // DOM element to appear (SPA pages may still be hydrating / loading data)
      // then execute directly without re-planning.
      const actionName = pendingNav.plannedAction;
      const actionArgs = pendingNav.plannedArgs ?? {};

      chat.addMessage('system', `Waiting for page to load...`);
      chat.setEnabled(false);

      const actionEl = await waitForActionElement(actionName, 10_000);
      if (actionEl) {
        chat.addMessage('system', `Executing ${actionName}...`);
        const result = await executeOnDOM(actionName, actionArgs, false, manifest, securityOpts);

        if (result.status === 'needs_confirmation' && result.confirmation_metadata) {
          const confirmed = await showConfirmation(chat.shadow, result.confirmation_metadata);
          if (confirmed) {
            const confirmedResult = await executeOnDOM(actionName, actionArgs, true, manifest, securityOpts);
            const msg = confirmedResult.status === 'completed'
              ? (confirmedResult.result || 'Action completed successfully.')
              : `${confirmedResult.status}: ${confirmedResult.error || 'Unknown error'}`;
            chat.addMessage(confirmedResult.status === 'completed' ? 'assistant' : 'error', msg);
          } else {
            chat.addMessage('system', 'Action cancelled by user.');
          }
        } else if (result.status === 'awaiting_review') {
          const msg = 'Form filled — review and submit when ready, or say "submit" to send.';
          chat.addMessage('assistant', msg);
          pendingReview = { action: actionName, args: { ...actionArgs } };
        } else if (result.status === 'completed') {
          const msg = result.result || 'Action completed successfully.';
          chat.addMessage('assistant', msg);
          lastPlan = null;
          history.length = 0;
        } else {
          const msg = `${result.status}: ${result.error || 'Unknown error'}`;
          chat.addMessage('error', msg);
          lastPlan = null;
        }
      } else {
        // Action element didn't appear within timeout — fall back to re-planning
        chat.addMessage('system', `Action element not found on page, re-planning...`);
        isNavigationResend = true;
        handleUserMessage(pendingNav.userMessage);
        return;
      }
      chat.setEnabled(true);
    } else {
      // No pre-planned action — re-send the original user message to plan against the new page.
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
    lastUserMessage = text;

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

      // Enrich on-page actions with manifest schema data (type, enum, required)
      const enrichedCatalog = manifest
        ? enrichCatalogWithSchema(catalog, manifest)
        : catalog;

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

      if (enrichedCatalog.actions.length === 0 && !hasSiteContext) {
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
      const { result: planResult, debug: planDebug } = hasSiteContext
        ? await planner.planSiteAware(contextualMessage, enrichedCatalog, otherPageActions, pageSummaries, pageData, dataViews, discoveredLinks)
        : await planner.plan(contextualMessage, enrichedCatalog, pageData);

      // Compute valid routes (same logic as planner uses)
      const validRoutes = [
        ...pageSummaries.filter((p) => !p.route.includes(':')).map((p) => p.route),
        ...discoveredLinks.map((l) => l.page),
      ];

      // Emit debug block with planner + widget context
      chat.addDebugBlock({
        ...planDebug,
        parsedResult: planResult,
        discoveredActions: catalog.actions.map((a) => a.action),
        discoveredLinks: discoveredLinks.map((l) => l.page),
        validRoutes,
        pageDataPreview: (pageData ?? '').slice(0, 500),
      });

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
        lastPlan = null;
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
          lastPlan = null;
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
          lastPlan = null;
          chat.setEnabled(true);
          return;
        }

        chat.addMessage('system', `Navigating to ${targetPage}...`);
        persistNavigation(targetPage, text, history, false, request.action, request.args);
        window.location.href = targetPage;
        return;
      }

      // Execute (coercion happens inside executeOnDOM)
      let result = await executeOnDOM(request.action, request.args, request.confirmed || false, manifest, securityOpts);

      // Handle confirmation
      if (result.status === 'needs_confirmation' && result.confirmation_metadata) {
        const confirmed = await showConfirmation(chat.shadow, result.confirmation_metadata);
        if (confirmed) {
          result = await executeOnDOM(request.action, request.args, true, manifest, securityOpts);
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
        // Clear plan and history after successful execution so completed
        // action details (e.g. login credentials) don't pollute context
        // for the next unrelated request — small LLMs latch onto stale actions.
        lastPlan = null;
        history.length = 0;
      } else {
        const msg = `${result.status}: ${result.error || 'Unknown error'}`;
        chat.addMessage('error', msg);
        history.push({ role: 'error', text: msg });
        lastPlan = null;
      }
    } catch (err) {
      const msg = (err as Error).message;
      chat.addMessage('error', msg);
      history.push({ role: 'error', text: msg });
      lastPlan = null;

      // Show debug block on planner failures so users can inspect prompts/responses
      if (err instanceof PlannerError) {
        chat.enableDebug();
        chat.addDebugBlock({
          ...err.debug,
          parsedResult: { error: msg },
          discoveredActions: [],
          discoveredLinks: [],
          validRoutes: [],
          pageDataPreview: '',
        });
      }
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

// Auto-init when DOM is ready.
// For SPAs, the initial DOM may be empty (e.g. <div id="root"></div>) when this
// script runs.  If `init()` bails because no [data-agent-kind] elements exist,
// we watch for mutations until they appear (up to 15 seconds).
function initWithSPARetry(): void {
  const hasAAF = () => document.querySelectorAll('[data-agent-kind]').length > 0;

  if (hasAAF()) {
    init();
    return;
  }

  // No AAF elements yet — observe the DOM for SPA hydration
  const timeout = setTimeout(() => { observer.disconnect(); }, 15_000);
  const observer = new MutationObserver(() => {
    if (hasAAF()) {
      observer.disconnect();
      clearTimeout(timeout);
      init();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWithSPARetry);
} else {
  initWithSPARetry();
}
