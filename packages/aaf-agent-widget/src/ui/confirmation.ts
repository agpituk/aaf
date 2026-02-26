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
    const existing = shadowRoot.querySelector('.aaf-confirmation');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'aaf-confirmation';
    overlay.innerHTML = `
      <div class="aaf-confirmation-content">
        <h3>${escapeHtml(meta.title)}</h3>
        <p>This action requires confirmation before proceeding.</p>
        <div class="aaf-confirmation-meta">
          <span class="aaf-risk-badge ${escapeHtml(meta.risk)}">${escapeHtml(meta.risk)} risk</span>
          <span class="aaf-meta-tag">${escapeHtml(meta.scope)}</span>
        </div>
        <div class="aaf-confirmation-buttons">
          <button class="aaf-btn aaf-btn-secondary" data-aaf-cancel>Cancel</button>
          <button class="aaf-btn aaf-btn-danger" data-aaf-confirm>Confirm</button>
        </div>
      </div>
    `;

    const panel = shadowRoot.querySelector('.aaf-panel');
    if (panel) {
      panel.appendChild(overlay);
    }

    const cleanup = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('[data-aaf-confirm]')!.addEventListener('click', () => cleanup(true));
    overlay.querySelector('[data-aaf-cancel]')!.addEventListener('click', () => cleanup(false));
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
