import { readable } from 'svelte/store';
import type { DiscoveredActionSummary } from './types.js';

/**
 * Readable store that discovers AAF actions from the current page DOM.
 * Updates when DOM changes via MutationObserver.
 */
export const agentActions = readable<DiscoveredActionSummary[]>([], (set) => {
  if (typeof document === 'undefined') return;

  function discover(): DiscoveredActionSummary[] {
    const actions: DiscoveredActionSummary[] = [];
    const actionElements = document.querySelectorAll('[data-agent-kind="action"][data-agent-action]');

    for (const el of actionElements) {
      const actionName = el.getAttribute('data-agent-action');
      if (!actionName || actionName.endsWith('.submit')) continue;

      const fields: Array<{ field: string; tagName: string }> = [];
      const fieldElements = el.querySelectorAll('[data-agent-kind="field"][data-agent-field]');
      for (const fieldEl of fieldElements) {
        fields.push({
          field: fieldEl.getAttribute('data-agent-field')!,
          tagName: fieldEl.tagName.toLowerCase(),
        });
      }

      actions.push({
        action: actionName,
        title: undefined,
        risk: el.getAttribute('data-agent-danger') || undefined,
        confirmation: el.getAttribute('data-agent-confirm') || undefined,
        scope: el.getAttribute('data-agent-scope') || undefined,
        fields,
      });
    }

    return actions;
  }

  set(discover());

  const observer = new MutationObserver(() => set(discover()));
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  return () => observer.disconnect();
});
