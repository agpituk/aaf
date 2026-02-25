import type { DiscoveredAction } from '@agent-native-web/runtime-core/types';

/**
 * Renders action cards for the inspector panel.
 */
export function renderActionCards(actions: DiscoveredAction[]): string {
  if (actions.length === 0) {
    return '<p class="muted">No AWI actions found on this page.</p>';
  }

  return actions.map((action) => renderActionCard(action)).join('');
}

function renderActionCard(action: DiscoveredAction): string {
  const riskClass = action.danger || 'none';
  const fields = action.fields
    .map(
      (f) => `<div class="field-item"><span>${f.field}</span><span class="meta-tag">${f.tagName}</span></div>`
    )
    .join('');

  const metaTags = [
    action.danger ? `<span class="risk-badge ${riskClass}">${action.danger} risk</span>` : '',
    action.confirm ? `<span class="meta-tag">confirm: ${action.confirm}</span>` : '',
    action.scope ? `<span class="meta-tag">scope: ${action.scope}</span>` : '',
    action.idempotent ? `<span class="meta-tag">idempotent: ${action.idempotent}</span>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `
    <div class="action-card">
      <h4>
        <span class="risk-badge ${riskClass}">${riskClass}</span>
        ${action.action}
      </h4>
      <div class="meta-row">${metaTags}</div>
      ${fields ? `<div class="fields"><strong>Fields:</strong>${fields}</div>` : ''}
      ${action.submitAction ? `<div class="meta-row"><span class="meta-tag">submit: ${action.submitAction}</span></div>` : ''}
    </div>
  `;
}
