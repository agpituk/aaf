/**
 * Scoped CSS for the AWI agent widget.
 * Injected into shadow DOM — no style leaks.
 */
export const widgetStyles = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  /* Toggle button */
  .awi-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #2563eb;
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(37, 99, 235, 0.4);
    z-index: 10000;
    transition: background 0.15s, transform 0.15s;
  }

  .awi-toggle:hover {
    background: #1d4ed8;
    transform: scale(1.05);
  }

  .awi-toggle.open {
    background: #64748b;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Chat panel */
  .awi-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 440px;
    max-height: 600px;
    background: #f8f9fa;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    display: none;
    flex-direction: column;
    overflow: hidden;
    z-index: 9999;
  }

  .awi-panel.open {
    display: flex;
  }

  /* Header */
  .awi-header {
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .awi-header h2 {
    font-size: 14px;
    font-weight: 600;
  }

  .awi-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: 500;
  }

  .awi-badge.offline {
    background: #fff3e0;
    color: #e65100;
  }

  /* Messages */
  .awi-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 240px;
    max-height: 440px;
  }

  .awi-msg {
    padding: 8px 12px;
    border-radius: 8px;
    max-width: 90%;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: pre-wrap;
    font-size: 13px;
  }

  .awi-msg.user {
    background: #2563eb;
    color: #fff;
    align-self: flex-end;
    border-bottom-right-radius: 2px;
  }

  .awi-msg.assistant {
    background: #fff;
    border: 1px solid #e0e0e0;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
  }

  .awi-msg.system {
    background: #fef3cd;
    border: 1px solid #ffc107;
    align-self: center;
    font-size: 12px;
    text-align: center;
  }

  .awi-msg.error {
    background: #fee;
    border: 1px solid #f44336;
    color: #c62828;
    align-self: center;
    font-size: 12px;
  }

  .awi-msg pre {
    background: #f5f5f5;
    padding: 6px 8px;
    border-radius: 4px;
    overflow-x: auto;
    margin-top: 4px;
    font-size: 11px;
  }

  /* Input */
  .awi-input {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #e0e0e0;
    background: #fff;
  }

  .awi-input input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }

  .awi-input input:focus {
    border-color: #2563eb;
  }

  .awi-input input:disabled {
    background: #f0f0f0;
    color: #999;
  }

  /* Buttons */
  .awi-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s;
    font-family: inherit;
  }

  .awi-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .awi-btn-primary {
    background: #2563eb;
    color: #fff;
  }

  .awi-btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .awi-btn-secondary {
    background: #e0e0e0;
    color: #333;
  }

  .awi-btn-secondary:hover:not(:disabled) {
    background: #d0d0d0;
  }

  .awi-btn-danger {
    background: #ef4444;
    color: #fff;
  }

  .awi-btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  /* Confirmation overlay */
  .awi-confirmation {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 12px;
  }

  .awi-confirmation.hidden {
    display: none;
  }

  .awi-confirmation-content {
    background: #fff;
    padding: 20px;
    border-radius: 12px;
    max-width: 300px;
    width: 90%;
  }

  .awi-confirmation-content h3 {
    margin-bottom: 8px;
    font-size: 14px;
  }

  .awi-confirmation-content p {
    font-size: 12px;
    color: #666;
    margin-bottom: 12px;
  }

  .awi-confirmation-meta {
    display: flex;
    gap: 8px;
    margin: 12px 0;
  }

  .awi-confirmation-buttons {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .awi-risk-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .awi-risk-badge.high {
    background: #fee;
    color: #c62828;
  }

  .awi-risk-badge.low {
    background: #fff3e0;
    color: #e65100;
  }

  .awi-risk-badge.none {
    background: #e8f5e9;
    color: #2e7d32;
  }

  /* Action cards (inspector mode) */
  .awi-actions {
    padding: 12px 16px;
    overflow-y: auto;
    max-height: 340px;
  }

  .awi-action-card {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .awi-action-card h4 {
    font-size: 13px;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .awi-field-item {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 12px;
    color: #555;
  }

  .awi-meta-row {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .awi-meta-tag {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    background: #f0f0f0;
    color: #555;
  }

  .awi-muted {
    color: #999;
    font-style: italic;
    padding: 20px;
    text-align: center;
  }
`;
