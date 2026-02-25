import {
  SemanticParser,
  ManifestValidator,
  PolicyEngine,
  ExecutionLogger,
  coerceArgs,
  type AgentManifest,
  type ActionCatalog,
  type ExecutionResult,
} from '@agent-native-web/runtime-core';
import { HarborPlanner } from './harbor-planner.js';
import { ChatUI } from './ui/chat.js';
import { showConfirmation } from './ui/confirmation.js';

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

    // Fill fields using native value setter + event dispatch
    for (const field of discovered.fields) {
      const value = coercedArgs[field.field];
      if (value === undefined) continue;

      const el = document.querySelector(
        `[data-agent-field="${field.field}"]`,
      ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
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
    const statusEl = document.querySelector('[data-agent-kind="status"]');
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

/** Boot the AWI agent widget */
async function init(): Promise<void> {
  // Bail if no AWI elements on the page
  if (document.querySelectorAll('[data-agent-kind]').length === 0) return;

  const planner = new HarborPlanner();
  const parser = new SemanticParser();
  let manifest: AgentManifest | null = null;

  // Conversation memory — tracks last plan + recent exchanges for follow-ups
  interface ConversationTurn { role: 'user' | 'assistant' | 'error'; text: string }
  const history: ConversationTurn[] = [];
  let lastPlan: { action: string; args: Record<string, unknown> } | null = null;

  const chat = new ChatUI({
    onSubmit: (text) => handleUserMessage(text),
  });

  chat.mount();

  // Detect backend and show badge
  const backend = await planner.detectBackend();
  if (backend === 'harbor') {
    chat.setBadge('Harbor', true);
  } else if (backend === 'ollama') {
    chat.setBadge('Ollama', true);
  } else {
    chat.setBadge('inspect only', false);
    chat.addMessage('system', 'No LLM backend detected. Showing discovered actions only.');
    showInspector();
    return;
  }

  // Load manifest
  manifest = await fetchManifest();

  async function handleUserMessage(text: string): Promise<void> {
    chat.addMessage('user', text);
    chat.setEnabled(false);
    history.push({ role: 'user', text });

    try {
      // Discover actions
      const catalog: ActionCatalog = {
        actions: parser.discoverActions(document.body),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      if (catalog.actions.length === 0) {
        // No actions — try data chat mode
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

      // Plan
      chat.addMessage('system', 'Planning...');
      const planResult = await planner.plan(contextualMessage, catalog, pageData);

      // Handle informational answers (no action to execute)
      if (planResult.kind === 'answer') {
        chat.addMessage('system', 'Answering from page data...');
        chat.addMessage('assistant', planResult.text);
        history.push({ role: 'assistant', text: planResult.text });
        chat.setEnabled(true);
        return;
      }

      const request = planResult.request;
      chat.addMessage('assistant', `Action: ${request.action}\nArgs: ${JSON.stringify(request.args, null, 2)}`);

      // Save plan for follow-up context
      lastPlan = { action: request.action, args: { ...request.args } };
      history.push({ role: 'assistant', text: `Planned: ${request.action} with ${JSON.stringify(request.args)}` });

      if (!manifest) {
        chat.addMessage('error', 'No manifest available — cannot execute.');
        chat.setEnabled(true);
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
      chat.addMessage('system', 'No AWI actions found on this page.');
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
