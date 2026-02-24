import type { SemanticElement, AgentKind, DiscoveredAction, DiscoveredField, DiscoveredStatus } from './types.js';

const AGENT_KINDS: Set<string> = new Set(['action', 'field', 'status', 'result', 'collection', 'item', 'dialog', 'step']);

interface HtmlElement {
  tagName: string;
  getAttribute(name: string): string | null;
  textContent: string | null;
  children: ArrayLike<HtmlElement>;
  querySelectorAll(selector: string): ArrayLike<HtmlElement>;
}

export class SemanticParser {
  parseElement(el: HtmlElement): SemanticElement | null {
    const kind = el.getAttribute('data-agent-kind');
    if (!kind || !AGENT_KINDS.has(kind)) return null;

    return {
      kind: kind as AgentKind,
      action: el.getAttribute('data-agent-action') ?? undefined,
      field: el.getAttribute('data-agent-field') ?? undefined,
      output: el.getAttribute('data-agent-output') ?? undefined,
      danger: el.getAttribute('data-agent-danger') ?? undefined,
      confirm: el.getAttribute('data-agent-confirm') ?? undefined,
      scope: el.getAttribute('data-agent-scope') ?? undefined,
      idempotent: el.getAttribute('data-agent-idempotent') ?? undefined,
      forAction: el.getAttribute('data-agent-for-action') ?? undefined,
      version: el.getAttribute('data-agent-version') ?? undefined,
      tagName: el.tagName.toLowerCase(),
      textContent: el.textContent?.trim() ?? undefined,
      children: this.parseChildren(el),
    };
  }

  parseChildren(parent: HtmlElement): SemanticElement[] {
    const results: SemanticElement[] = [];
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      const parsed = this.parseElement(child);
      if (parsed) {
        results.push(parsed);
      } else {
        results.push(...this.parseChildren(child));
      }
    }
    return results;
  }

  discoverActions(root: HtmlElement): DiscoveredAction[] {
    const actionEls = root.querySelectorAll('[data-agent-kind="action"][data-agent-action]');
    const actions: DiscoveredAction[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < actionEls.length; i++) {
      const el = actionEls[i];
      const actionName = el.getAttribute('data-agent-action')!;

      // Skip sub-actions like "invoice.create.submit"
      if (actionName.split('.').length > 2) continue;
      if (seen.has(actionName)) continue;
      seen.add(actionName);

      const fields = this.discoverFields(root, el, actionName);
      const statuses = this.discoverStatuses(root, el, actionName);
      const submitAction = this.findSubmitAction(el, actionName);

      actions.push({
        action: actionName,
        kind: 'action',
        danger: el.getAttribute('data-agent-danger') ?? undefined,
        confirm: el.getAttribute('data-agent-confirm') ?? undefined,
        scope: el.getAttribute('data-agent-scope') ?? undefined,
        idempotent: el.getAttribute('data-agent-idempotent') ?? undefined,
        fields,
        statuses,
        submitAction,
      });
    }

    return actions;
  }

  private discoverFields(root: HtmlElement, actionEl: HtmlElement, actionName: string): DiscoveredField[] {
    const fields: DiscoveredField[] = [];
    // Fields nested inside the action element
    const nested = actionEl.querySelectorAll('[data-agent-kind="field"]');
    for (let i = 0; i < nested.length; i++) {
      const f = nested[i];
      fields.push({
        field: f.getAttribute('data-agent-field')!,
        tagName: f.tagName.toLowerCase(),
        forAction: f.getAttribute('data-agent-for-action') ?? undefined,
      });
    }
    // Fields elsewhere linked via data-agent-for-action
    const linked = root.querySelectorAll(`[data-agent-kind="field"][data-agent-for-action="${actionName}"]`);
    for (let i = 0; i < linked.length; i++) {
      const f = linked[i];
      const fieldName = f.getAttribute('data-agent-field')!;
      if (!fields.some((existing) => existing.field === fieldName)) {
        fields.push({
          field: fieldName,
          tagName: f.tagName.toLowerCase(),
          forAction: actionName,
        });
      }
    }
    return fields;
  }

  private discoverStatuses(root: HtmlElement, actionEl: HtmlElement, _actionName: string): DiscoveredStatus[] {
    const statuses: DiscoveredStatus[] = [];
    const nested = actionEl.querySelectorAll('[data-agent-kind="status"]');
    for (let i = 0; i < nested.length; i++) {
      const s = nested[i];
      statuses.push({
        output: s.getAttribute('data-agent-output')!,
        tagName: s.tagName.toLowerCase(),
      });
    }
    return statuses;
  }

  private findSubmitAction(actionEl: HtmlElement, actionName: string): string | undefined {
    const submitEls = actionEl.querySelectorAll('[data-agent-kind="action"]');
    for (let i = 0; i < submitEls.length; i++) {
      const sub = submitEls[i];
      const subAction = sub.getAttribute('data-agent-action');
      if (subAction && subAction.startsWith(actionName + '.')) {
        return subAction;
      }
    }
    return undefined;
  }
}
