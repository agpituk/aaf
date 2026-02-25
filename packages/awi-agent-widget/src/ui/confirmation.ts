export interface ConfirmationMeta {
  action: string;
  risk: string;
  scope: string;
  title: string;
}

/**
 * Shows a confirmation dialog for high-risk actions inside the chat panel shadow DOM.
 * Returns a promise that resolves to true (confirmed) or false (cancelled).
 */
export function showConfirmation(shadowRoot: ShadowRoot, meta: ConfirmationMeta): Promise<boolean> {
  return new Promise((resolve) => {
    // Remove any existing confirmation
    const existing = shadowRoot.querySelector('.awi-confirmation');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'awi-confirmation';
    overlay.innerHTML = `
      <div class="awi-confirmation-content">
        <h3>${escapeHtml(meta.title)}</h3>
        <p>This action requires confirmation before proceeding.</p>
        <div class="awi-confirmation-meta">
          <span class="awi-risk-badge ${escapeHtml(meta.risk)}">${escapeHtml(meta.risk)} risk</span>
          <span class="awi-meta-tag">${escapeHtml(meta.scope)}</span>
        </div>
        <div class="awi-confirmation-buttons">
          <button class="awi-btn awi-btn-secondary" data-awi-cancel>Cancel</button>
          <button class="awi-btn awi-btn-danger" data-awi-confirm>Confirm</button>
        </div>
      </div>
    `;

    const panel = shadowRoot.querySelector('.awi-panel');
    if (panel) {
      panel.appendChild(overlay);
    }

    const cleanup = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('[data-awi-confirm]')!.addEventListener('click', () => cleanup(true));
    overlay.querySelector('[data-awi-cancel]')!.addEventListener('click', () => cleanup(false));
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
