// Import from a CSP-safe subset of runtime-core (excludes ManifestValidator → AJV).
// AJV uses new Function() which is blocked by Firefox extension CSP.
import { SemanticParser } from '@agent-native-web/runtime-core/semantic-parser';
import { PolicyEngine } from '@agent-native-web/runtime-core/policy-engine';
import { ExecutionLogger } from '@agent-native-web/runtime-core/execution-logger';
import { coerceArgs } from '@agent-native-web/runtime-core/coerce-args';
import type {
  AgentManifest,
  AgentAction,
  AWIAdapter,
  ActionCatalog,
  AWIValidationResult,
  ExecuteOptions,
  ExecutionResult,
} from '@agent-native-web/runtime-core/types';
import { fetchManifest } from './manifest-fetcher.js';

/**
 * Lightweight manifest lookup — avoids AJV (which uses new Function()
 * and is blocked by Firefox extension CSP).
 */
function getAction(manifest: AgentManifest, actionName: string): AgentAction {
  const action = manifest.actions[actionName];
  if (!action) throw new Error(`Action "${actionName}" not found in manifest`);
  return action;
}

function validateInput(action: AgentAction, args: Record<string, unknown>): AWIValidationResult {
  const schema = action.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
  if (schema.required) {
    const missing = schema.required.filter((f) => args[f] === undefined || args[f] === '');
    if (missing.length > 0) {
      return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`], missing_fields: missing };
    }
  }
  return { valid: true, errors: [] };
}

/**
 * AWIAdapter implementation for the browser extension content script.
 * Operates directly on the real DOM — SemanticParser's HtmlElement interface
 * is natively satisfied by browser DOM elements.
 */
export class DomAdapter implements AWIAdapter {
  private parser = new SemanticParser();
  private policy = new PolicyEngine();
  private manifest: AgentManifest | null = null;

  async detect(): Promise<boolean> {
    return document.querySelectorAll('[data-agent-kind]').length > 0;
  }

  async discover(): Promise<ActionCatalog> {
    if (!this.manifest) {
      this.manifest = await fetchManifest();
    }

    // SemanticParser works directly on real DOM elements
    const actions = this.parser.discoverActions(document.body);

    return {
      actions,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };
  }

  validate(actionName: string, args: Record<string, unknown>, manifest?: AgentManifest): AWIValidationResult {
    const m = manifest || this.manifest;
    if (!m) {
      return { valid: false, errors: ['No manifest available'] };
    }

    try {
      const action = getAction(m, actionName);
      return validateInput(action, args);
    } catch (err) {
      return { valid: false, errors: [(err as Error).message] };
    }
  }

  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    const { actionName, args: rawArgs, confirmed } = options;
    const manifest = options.manifest || this.manifest;

    if (!manifest) {
      return { status: 'execution_error', error: 'No manifest available' };
    }

    const logger = new ExecutionLogger(actionName, 'ui');

    try {
      const action = getAction(manifest, actionName);

      // Coerce args before policy/validation
      const { args, coercions } = coerceArgs(rawArgs, action.inputSchema);
      logger.coerce(coercions);

      // Policy check
      const policyResult = this.policy.checkExecution(action, {
        confirmed,
        requiredFields: args,
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

        const schema = action.inputSchema as { required?: string[] };
        if (schema.required) {
          const missing = schema.required.filter((f) => args[f] === undefined || args[f] === '');
          if (missing.length > 0) {
            return {
              status: 'missing_required_fields',
              missing_fields: missing,
              error: policyResult.reason,
              log: logger.toLog(),
            };
          }
        }

        return { status: 'execution_error', error: policyResult.reason, log: logger.toLog() };
      }
      logger.policyCheck('PASSED');

      // Validate input
      const validation = this.validate(actionName, args, manifest);
      if (!validation.valid) {
        logger.validate(`FAILED: ${validation.errors.join(', ')}`);
        if (validation.missing_fields) {
          return {
            status: 'missing_required_fields',
            missing_fields: validation.missing_fields,
            error: validation.errors.join(', '),
            log: logger.toLog(),
          };
        }
        return { status: 'validation_error', error: validation.errors.join(', '), log: logger.toLog() };
      }
      logger.validate('PASSED');

      // Discover the action on the page
      const catalog = await this.discover();
      const discovered = catalog.actions.find((a) => a.action === actionName);
      if (!discovered) {
        return { status: 'execution_error', error: `Action "${actionName}" not found on page`, log: logger.toLog() };
      }

      // Fill fields using native value setter + event dispatch
      for (const field of discovered.fields) {
        const value = args[field.field];
        if (value === undefined) continue;

        const el = document.querySelector(`[data-agent-field="${field.field}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!el) continue;

        // Use native value setter to trigger framework reactivity
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
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
}
