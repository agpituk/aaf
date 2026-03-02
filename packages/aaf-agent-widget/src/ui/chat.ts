import { widgetStyles } from './styles.js';

export type MessageType = 'user' | 'assistant' | 'system' | 'error';

export interface DebugBlockData {
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
  latencyMs: number;
  attempts: number;
  parsedResult: unknown;
  discoveredActions: string[];
  discoveredLinks: string[];
  validRoutes: string[];
  pageDataPreview: string;
}

export interface ChatUIOptions {
  onSubmit: (text: string) => void;
  onRetry?: () => void;
  onModelChange?: (model: string) => void;
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
  private debugToggle!: HTMLButtonElement;
  private modelSelect!: HTMLSelectElement;
  private debugMode = false;
  private onSubmit: (text: string) => void;
  private onRetry?: () => void;
  private onModelChange?: (model: string) => void;

  constructor(options: ChatUIOptions) {
    this.onSubmit = options.onSubmit;
    this.onRetry = options.onRetry;
    this.onModelChange = options.onModelChange;

    // Create shadow DOM host
    this.host = document.createElement('div');
    this.host.id = 'aaf-agent-root';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = widgetStyles;
    this.shadow.appendChild(style);

    // Toggle button
    this.toggle = document.createElement('button');
    this.toggle.className = 'aaf-toggle';
    this.toggle.textContent = '\u2728';
    this.toggle.title = 'AAF Agent';
    this.toggle.addEventListener('click', () => this.togglePanel());
    this.shadow.appendChild(this.toggle);

    // Chat panel
    this.panel = document.createElement('div');
    this.panel.className = 'aaf-panel';
    this.panel.innerHTML = `
      <div class="aaf-header">
        <h2>AAF Agent</h2>
        <div class="aaf-header-right">
          <select class="aaf-model-select" title="Select LLM model">
            <option value="">detecting...</option>
          </select>
          <button class="aaf-debug-toggle" title="Toggle debug mode">&#x1f41b;</button>
          <span class="aaf-badge">ready</span>
        </div>
      </div>
      <div class="aaf-messages"></div>
      <div class="aaf-input">
        <input type="text" placeholder="Ask the agent..." />
        <button class="aaf-btn aaf-btn-primary">Send</button>
      </div>
    `;
    this.shadow.appendChild(this.panel);

    this.messages = this.panel.querySelector('.aaf-messages')!;
    this.input = this.panel.querySelector('.aaf-input input')! as HTMLInputElement;
    this.sendBtn = this.panel.querySelector('.aaf-input button')! as HTMLButtonElement;
    this.debugToggle = this.panel.querySelector('.aaf-debug-toggle')! as HTMLButtonElement;
    this.modelSelect = this.panel.querySelector('.aaf-model-select')! as HTMLSelectElement;

    // Wire debug toggle
    this.debugToggle.addEventListener('click', () => {
      this.debugMode = !this.debugMode;
      this.messages.classList.toggle('aaf-debug-on', this.debugMode);
      this.debugToggle.classList.toggle('active', this.debugMode);
    });

    // Wire model selector
    this.modelSelect.addEventListener('change', () => {
      const model = this.modelSelect.value;
      if (model && this.onModelChange) {
        this.onModelChange(model);
      }
    });

    // Wire input events
    this.sendBtn.addEventListener('click', () => this.handleSubmit());
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSubmit();
      }
    });
  }

  /** Open the chat panel (no-op if already open) */
  open(): void {
    if (!this.panel.classList.contains('open')) {
      this.togglePanel();
    }
  }

  /** Mount the widget into the document */
  mount(): void {
    document.body.appendChild(this.host);
  }

  /** Add a message to the chat */
  addMessage(type: MessageType, text: string): void {
    const msg = document.createElement('div');
    msg.className = `aaf-msg ${type}`;
    msg.textContent = text;

    // Add retry button to error messages
    if (type === 'error' && this.onRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'aaf-retry-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.title = 'Retry the last message';
      retryBtn.addEventListener('click', () => {
        if (this.onRetry) this.onRetry();
      });
      msg.appendChild(retryBtn);
    }

    this.messages.appendChild(msg);
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  /** Update the backend badge */
  setBadge(label: string, online: boolean): void {
    const badge = this.panel.querySelector('.aaf-badge') as HTMLElement;
    if (badge) {
      badge.textContent = label;
      badge.className = online ? 'aaf-badge' : 'aaf-badge offline';
    }
  }

  /** Populate the model dropdown with available models */
  setModels(models: string[], currentModel: string): void {
    this.modelSelect.innerHTML = '';
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      if (model === currentModel) option.selected = true;
      this.modelSelect.appendChild(option);
    }
    this.modelSelect.style.display = models.length > 0 ? '' : 'none';
  }

  /** Add a collapsible debug block with planner diagnostics */
  addDebugBlock(data: DebugBlockData): void {
    const details = document.createElement('details');
    details.className = 'aaf-debug';

    const summary = document.createElement('summary');
    summary.textContent = `Debug | ${data.latencyMs}ms | attempt ${data.attempts}`;
    details.appendChild(summary);

    const sections: [string, string][] = [
      ['System Prompt', data.systemPrompt],
      ['User Prompt', data.userPrompt],
      ['Raw LLM Response', data.rawResponse],
      ['Parsed Result', JSON.stringify(data.parsedResult, null, 2)],
      ['Discovered Actions', data.discoveredActions.join(', ') || '(none)'],
      ['Discovered Links', data.discoveredLinks.join('\n') || '(none)'],
      ['Valid Routes', data.validRoutes.join('\n') || '(none)'],
      ['Page Data', data.pageDataPreview || '(none)'],
    ];

    for (const [label, content] of sections) {
      const section = document.createElement('div');
      section.className = 'aaf-debug-section';

      const strong = document.createElement('strong');
      strong.textContent = label;
      section.appendChild(strong);

      const pre = document.createElement('pre');
      pre.textContent = content;
      section.appendChild(pre);

      details.appendChild(section);
    }

    this.messages.appendChild(details);
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  /** Enable debug mode (no-op if already enabled) */
  enableDebug(): void {
    if (!this.debugMode) {
      this.debugMode = true;
      this.messages.classList.add('aaf-debug-on');
      this.debugToggle.classList.add('active');
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
