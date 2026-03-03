import type { DiscoveredActionSummary } from './types.js';

/**
 * Client-side hook: reads AAF annotations from the current page DOM
 * and returns discovered actions.
 *
 * Note: This is a plain function, not a React hook, to avoid React dependency
 * issues in test environments. In a real Next.js app, wrap it in useMemo/useEffect.
 */
export function useAgentActions(): DiscoveredActionSummary[] {
  if (typeof document === 'undefined') return [];

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
      risk: el.getAttribute('data-agent-danger') || undefined,
      confirmation: el.getAttribute('data-agent-confirm') || undefined,
      scope: el.getAttribute('data-agent-scope') || undefined,
      fields,
    });
  }

  return actions;
}
