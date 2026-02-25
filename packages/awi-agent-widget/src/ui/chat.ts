import { widgetStyles } from './styles.js';

export type MessageType = 'user' | 'assistant' | 'system' | 'error';

export interface ChatUIOptions {
  onSubmit: (text: string) => void;
}

/**
 * Floating chat panel rendered inside a shadow DOM host.
 * Provides message display, input, and a toggle button.
 */
export class ChatUI {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  private messages: HTMLElement;
  private input: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private panel: HTMLElement;
  private toggle: HTMLButtonElement;
  private onSubmit: (text: string) => void;

  constructor(options: ChatUIOptions) {
    this.onSubmit = options.onSubmit;

    // Create shadow DOM host
    this.host = document.createElement('div');
    this.host.id = 'awi-agent-root';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = widgetStyles;
    this.shadow.appendChild(style);

    // Toggle button
    this.toggle = document.createElement('button');
    this.toggle.className = 'awi-toggle';
    this.toggle.textContent = '\u2728';
    this.toggle.title = 'AWI Agent';
    this.toggle.addEventListener('click', () => this.togglePanel());
    this.shadow.appendChild(this.toggle);

    // Chat panel
    this.panel = document.createElement('div');
    this.panel.className = 'awi-panel';
    this.panel.innerHTML = `
      <div class="awi-header">
        <h2>AWI Agent</h2>
        <span class="awi-badge">ready</span>
      </div>
      <div class="awi-messages"></div>
      <div class="awi-input">
        <input type="text" placeholder="Ask the agent..." />
        <button class="awi-btn awi-btn-primary">Send</button>
      </div>
    `;
    this.shadow.appendChild(this.panel);

    this.messages = this.panel.querySelector('.awi-messages')!;
    this.input = this.panel.querySelector('.awi-input input')! as HTMLInputElement;
    this.sendBtn = this.panel.querySelector('.awi-input button')! as HTMLButtonElement;

    // Wire input events
    this.sendBtn.addEventListener('click', () => this.handleSubmit());
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSubmit();
      }
    });
  }

  /** Mount the widget into the document */
  mount(): void {
    document.body.appendChild(this.host);
  }

  /** Add a message to the chat */
  addMessage(type: MessageType, text: string): void {
    const msg = document.createElement('div');
    msg.className = `awi-msg ${type}`;
    msg.textContent = text;
    this.messages.appendChild(msg);
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  /** Update the backend badge */
  setBadge(label: string, online: boolean): void {
    const badge = this.panel.querySelector('.awi-badge') as HTMLElement;
    if (badge) {
      badge.textContent = label;
      badge.className = online ? 'awi-badge' : 'awi-badge offline';
    }
  }

  /** Enable or disable the input */
  setEnabled(enabled: boolean): void {
    this.input.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
  }

  private togglePanel(): void {
    const isOpen = this.panel.classList.toggle('open');
    this.toggle.classList.toggle('open', isOpen);
    this.toggle.textContent = isOpen ? '\u2716' : '\u2728';
    if (isOpen) {
      this.input.focus();
    }
  }

  private handleSubmit(): void {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = '';
    this.onSubmit(text);
  }
}
