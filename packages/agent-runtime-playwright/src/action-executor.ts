import type { Page } from '@playwright/test';
import {
  SemanticParser,
  ManifestValidator,
  PolicyEngine,
  ExecutionLogger,
  type AgentManifest,
  type ExecutionLog,
} from '@agent-native-web/runtime-core';

export interface ExecuteActionOptions {
  actionName: string;
  input: Record<string, unknown>;
  confirmed?: boolean;
  baseUrl: string;
  manifest: AgentManifest;
}

export class ActionExecutor {
  private parser = new SemanticParser();
  private validator = new ManifestValidator();
  private policy = new PolicyEngine();

  async execute(page: Page, options: ExecuteActionOptions): Promise<{ status: string; log: ExecutionLog }> {
    const { actionName, input, confirmed, baseUrl, manifest } = options;
    const logger = new ExecutionLogger(actionName, 'ui');

    // 1. Get action from manifest
    const action = this.validator.getAction(manifest, actionName);

    // 2. Validate input against schema
    const validation = this.validator.validateInput(action, input);
    if (!validation.valid) {
      logger.validate(`FAILED: ${validation.errors.join(', ')}`);
      throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
    }
    logger.validate('PASSED');

    // 3. Check policy
    const policyResult = this.policy.checkExecution(action, {
      confirmed,
      requiredFields: input,
    });
    if (!policyResult.allowed) {
      logger.policyCheck('BLOCKED', policyResult.reason);
      throw new Error(`Policy check failed: ${policyResult.reason}`);
    }
    logger.policyCheck('PASSED');

    // 4. Navigate to page
    const pagePath = action.ui?.page;
    if (pagePath) {
      const url = `${baseUrl}${pagePath}`;
      logger.navigate(url);
      await page.goto(url, { waitUntil: 'networkidle' });
    }

    // 5. Discover actions on the page
    const discoveredActions = await page.evaluate(() => {
      // We need to replicate simple discovery in browser context
      const actionEls = document.querySelectorAll('[data-agent-kind="action"][data-agent-action]');
      const actions: Array<{ action: string; fields: Array<{ field: string }>; submitAction?: string }> = [];
      const seen = new Set<string>();
      actionEls.forEach((el) => {
        const name = el.getAttribute('data-agent-action')!;
        if (name.split('.').length > 2 || seen.has(name)) return;
        seen.add(name);
        const fields: Array<{ field: string }> = [];
        // Nested fields
        el.querySelectorAll('[data-agent-kind="field"]').forEach((f) => {
          fields.push({ field: f.getAttribute('data-agent-field')! });
        });
        // Linked fields
        document.querySelectorAll(`[data-agent-kind="field"][data-agent-for-action="${name}"]`).forEach((f) => {
          const fieldName = f.getAttribute('data-agent-field')!;
          if (!fields.some((x) => x.field === fieldName)) {
            fields.push({ field: fieldName });
          }
        });
        // Submit action
        let submitAction: string | undefined;
        el.querySelectorAll('[data-agent-kind="action"]').forEach((sub) => {
          const subAction = sub.getAttribute('data-agent-action');
          if (subAction && subAction.startsWith(name + '.')) {
            submitAction = subAction;
          }
        });
        actions.push({ action: name, fields, submitAction });
      });
      return actions;
    });

    const discovered = discoveredActions.find((a) => a.action === actionName);
    if (!discovered) {
      throw new Error(`Action "${actionName}" not found on page`);
    }

    // 6. Fill fields
    for (const field of discovered.fields) {
      const value = input[field.field];
      if (value === undefined) continue;

      const selector = `[data-agent-field="${field.field}"]`;
      const tagName = await page.evaluate(
        (sel) => document.querySelector(sel)?.tagName.toLowerCase(),
        selector
      );

      if (tagName === 'select') {
        await page.selectOption(selector, String(value));
      } else if (tagName === 'textarea' || tagName === 'input') {
        await page.fill(selector, String(value));
      }
      logger.fill(field.field, value);
    }

    // 7. Click submit
    if (discovered.submitAction) {
      const submitSelector = `[data-agent-action="${discovered.submitAction}"]`;
      await page.click(submitSelector);
      logger.click(discovered.submitAction);
    } else {
      // Click the action element itself (for buttons like workspace.delete)
      const actionSelector = `[data-agent-action="${actionName}"]`;
      await page.click(actionSelector);
      logger.click(actionName);
    }

    // 8. Wait a moment for status to update
    await page.waitForTimeout(500);

    // 9. Read status
    const statusSelector = '[data-agent-kind="status"]';
    const statusText = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el?.textContent?.trim() || '';
    }, statusSelector);

    if (statusText) {
      const outputAttr = await page.evaluate((sel) => {
        return document.querySelector(sel)?.getAttribute('data-agent-output') || '';
      }, statusSelector);
      logger.readStatus(outputAttr, statusText);
    }

    return { status: statusText, log: logger.toLog() };
  }
}
