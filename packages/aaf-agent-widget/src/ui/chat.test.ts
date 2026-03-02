// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ChatUI, type DebugBlockData } from './chat.js';

function makeDebugData(overrides?: Partial<DebugBlockData>): DebugBlockData {
  return {
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Do something',
    rawResponse: '{"action":"click","args":{}}',
    latencyMs: 42,
    attempts: 1,
    parsedResult: { kind: 'action', request: { action: 'click', args: {} } },
    discoveredActions: ['click', 'submit'],
    discoveredLinks: ['/about', '/settings'],
    validRoutes: ['/dashboard', '/about'],
    pageDataPreview: 'Some page data here',
    ...overrides,
  };
}

describe('ChatUI', () => {
  it('creates a shadow DOM host element', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    expect(chat.host).toBeDefined();
    expect(chat.host.id).toBe('aaf-agent-root');
    expect(chat.shadow).toBeDefined();
    expect(chat.shadow.mode).toBe('open');
  });

  it('renders toggle button and closed panel', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const toggle = chat.shadow.querySelector('.aaf-toggle');
    const panel = chat.shadow.querySelector('.aaf-panel');

    expect(toggle).toBeTruthy();
    expect(panel).toBeTruthy();
    // Panel should be closed by default (no 'open' class)
    expect(panel!.classList.contains('open')).toBe(false);
  });

  it('adds messages of each type', () => {
    const chat = new ChatUI({ onSubmit: vi.fn(), onRetry: vi.fn() });
    chat.addMessage('user', 'Hello');
    chat.addMessage('assistant', 'Hi there');
    chat.addMessage('system', 'Connected');
    chat.addMessage('error', 'Something failed');

    const messages = chat.shadow.querySelectorAll('.aaf-msg');
    expect(messages).toHaveLength(4);
    expect(messages[0].classList.contains('user')).toBe(true);
    expect(messages[0].textContent).toBe('Hello');
    expect(messages[1].classList.contains('assistant')).toBe(true);
    expect(messages[2].classList.contains('system')).toBe(true);
    expect(messages[3].classList.contains('error')).toBe(true);
    expect(messages[3].textContent).toContain('Something failed');
  });

  it('adds retry button to error messages when onRetry is provided', () => {
    const onRetry = vi.fn();
    const chat = new ChatUI({ onSubmit: vi.fn(), onRetry });
    chat.addMessage('error', 'Something failed');

    const retryBtn = chat.shadow.querySelector('.aaf-retry-btn');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toBe('Retry');
  });

  it('does not add retry button to error messages when onRetry is not provided', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    chat.addMessage('error', 'Something failed');

    const retryBtn = chat.shadow.querySelector('.aaf-retry-btn');
    expect(retryBtn).toBeNull();
  });

  it('fires onRetry callback when retry button is clicked', () => {
    const onRetry = vi.fn();
    const chat = new ChatUI({ onSubmit: vi.fn(), onRetry });
    chat.addMessage('error', 'Something failed');

    const retryBtn = chat.shadow.querySelector('.aaf-retry-btn') as HTMLButtonElement;
    retryBtn.click();

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('populates model selector with setModels()', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    chat.setModels(['llama3.2', 'qwen3:latest', 'granite4:micro-h'], 'qwen3:latest');

    const select = chat.shadow.querySelector('.aaf-model-select') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(select.value).toBe('qwen3:latest');
  });

  it('fires onModelChange when model is selected', () => {
    const onModelChange = vi.fn();
    const chat = new ChatUI({ onSubmit: vi.fn(), onModelChange });
    chat.setModels(['llama3.2', 'qwen3:latest'], 'llama3.2');

    const select = chat.shadow.querySelector('.aaf-model-select') as HTMLSelectElement;
    select.value = 'qwen3:latest';
    select.dispatchEvent(new Event('change'));

    expect(onModelChange).toHaveBeenCalledWith('qwen3:latest');
  });

  it('fires onSubmit callback with input text', () => {
    const onSubmit = vi.fn();
    const chat = new ChatUI({ onSubmit });

    const input = chat.shadow.querySelector('.aaf-input input') as HTMLInputElement;
    const sendBtn = chat.shadow.querySelector('.aaf-input button') as HTMLButtonElement;

    input.value = 'Create an invoice';
    sendBtn.click();

    expect(onSubmit).toHaveBeenCalledWith('Create an invoice');
  });

  it('clears input after submit', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });

    const input = chat.shadow.querySelector('.aaf-input input') as HTMLInputElement;
    const sendBtn = chat.shadow.querySelector('.aaf-input button') as HTMLButtonElement;

    input.value = 'Some text';
    sendBtn.click();

    expect(input.value).toBe('');
  });

  it('does not fire onSubmit for empty input', () => {
    const onSubmit = vi.fn();
    const chat = new ChatUI({ onSubmit });

    const sendBtn = chat.shadow.querySelector('.aaf-input button') as HTMLButtonElement;
    sendBtn.click();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('updates badge text and class', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });

    chat.setBadge('Ollama', true);
    const badge = chat.shadow.querySelector('.aaf-badge') as HTMLElement;
    expect(badge.textContent).toBe('Ollama');
    expect(badge.classList.contains('offline')).toBe(false);

    chat.setBadge('offline', false);
    expect(badge.textContent).toBe('offline');
    expect(badge.classList.contains('offline')).toBe(true);
  });

  it('enables and disables input', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const input = chat.shadow.querySelector('.aaf-input input') as HTMLInputElement;
    const sendBtn = chat.shadow.querySelector('.aaf-input button') as HTMLButtonElement;

    chat.setEnabled(false);
    expect(input.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);

    chat.setEnabled(true);
    expect(input.disabled).toBe(false);
    expect(sendBtn.disabled).toBe(false);
  });

  it('open() opens a closed panel', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const panel = chat.shadow.querySelector('.aaf-panel')!;

    expect(panel.classList.contains('open')).toBe(false);
    chat.open();
    expect(panel.classList.contains('open')).toBe(true);
  });

  it('open() is a no-op if panel is already open', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const panel = chat.shadow.querySelector('.aaf-panel')!;

    chat.open();
    expect(panel.classList.contains('open')).toBe(true);

    // Call open() again — should stay open, not toggle closed
    chat.open();
    expect(panel.classList.contains('open')).toBe(true);
  });
});

describe('ChatUI debug toggle', () => {
  it('renders debug toggle button in header', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const toggle = chat.shadow.querySelector('.aaf-debug-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute('title')).toBe('Toggle debug mode');
  });

  it('enableDebug() activates debug mode programmatically', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const messages = chat.shadow.querySelector('.aaf-messages') as HTMLElement;
    const toggle = chat.shadow.querySelector('.aaf-debug-toggle') as HTMLElement;

    expect(messages.classList.contains('aaf-debug-on')).toBe(false);
    chat.enableDebug();
    expect(messages.classList.contains('aaf-debug-on')).toBe(true);
    expect(toggle.classList.contains('active')).toBe(true);

    // Calling again is a no-op
    chat.enableDebug();
    expect(messages.classList.contains('aaf-debug-on')).toBe(true);
  });

  it('toggles aaf-debug-on class on messages container when clicked', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const toggle = chat.shadow.querySelector('.aaf-debug-toggle') as HTMLButtonElement;
    const messages = chat.shadow.querySelector('.aaf-messages') as HTMLElement;

    expect(messages.classList.contains('aaf-debug-on')).toBe(false);
    expect(toggle.classList.contains('active')).toBe(false);

    toggle.click();
    expect(messages.classList.contains('aaf-debug-on')).toBe(true);
    expect(toggle.classList.contains('active')).toBe(true);

    toggle.click();
    expect(messages.classList.contains('aaf-debug-on')).toBe(false);
    expect(toggle.classList.contains('active')).toBe(false);
  });
});

describe('ChatUI addDebugBlock', () => {
  it('creates a details element with 8 debug sections', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    chat.addDebugBlock(makeDebugData());

    const details = chat.shadow.querySelector('details.aaf-debug');
    expect(details).toBeTruthy();

    const sections = details!.querySelectorAll('.aaf-debug-section');
    expect(sections.length).toBe(8);
  });

  it('summary contains latency and attempt info', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    chat.addDebugBlock(makeDebugData({ latencyMs: 123, attempts: 2 }));

    const summary = chat.shadow.querySelector('details.aaf-debug summary');
    expect(summary?.textContent).toContain('123ms');
    expect(summary?.textContent).toContain('attempt 2');
  });

  it('uses textContent for XSS safety', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    chat.addDebugBlock(makeDebugData({
      systemPrompt: '<script>alert("xss")</script>',
    }));

    const firstPre = chat.shadow.querySelector('.aaf-debug-section pre');
    expect(firstPre?.textContent).toContain('<script>');
    expect(firstPre?.innerHTML).not.toContain('<script>');
  });
});
