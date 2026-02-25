// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ChatUI } from './chat.js';

describe('ChatUI', () => {
  it('creates a shadow DOM host element', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    expect(chat.host).toBeDefined();
    expect(chat.host.id).toBe('awi-agent-root');
    expect(chat.shadow).toBeDefined();
    expect(chat.shadow.mode).toBe('open');
  });

  it('renders toggle button and closed panel', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const toggle = chat.shadow.querySelector('.awi-toggle');
    const panel = chat.shadow.querySelector('.awi-panel');

    expect(toggle).toBeTruthy();
    expect(panel).toBeTruthy();
    // Panel should be closed by default (no 'open' class)
    expect(panel!.classList.contains('open')).toBe(false);
  });

  it('adds messages of each type', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    chat.addMessage('user', 'Hello');
    chat.addMessage('assistant', 'Hi there');
    chat.addMessage('system', 'Connected');
    chat.addMessage('error', 'Something failed');

    const messages = chat.shadow.querySelectorAll('.awi-msg');
    expect(messages).toHaveLength(4);
    expect(messages[0].classList.contains('user')).toBe(true);
    expect(messages[0].textContent).toBe('Hello');
    expect(messages[1].classList.contains('assistant')).toBe(true);
    expect(messages[2].classList.contains('system')).toBe(true);
    expect(messages[3].classList.contains('error')).toBe(true);
    expect(messages[3].textContent).toBe('Something failed');
  });

  it('fires onSubmit callback with input text', () => {
    const onSubmit = vi.fn();
    const chat = new ChatUI({ onSubmit });

    const input = chat.shadow.querySelector('.awi-input input') as HTMLInputElement;
    const sendBtn = chat.shadow.querySelector('.awi-input button') as HTMLButtonElement;

    input.value = 'Create an invoice';
    sendBtn.click();

    expect(onSubmit).toHaveBeenCalledWith('Create an invoice');
  });

  it('clears input after submit', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });

    const input = chat.shadow.querySelector('.awi-input input') as HTMLInputElement;
    const sendBtn = chat.shadow.querySelector('.awi-input button') as HTMLButtonElement;

    input.value = 'Some text';
    sendBtn.click();

    expect(input.value).toBe('');
  });

  it('does not fire onSubmit for empty input', () => {
    const onSubmit = vi.fn();
    const chat = new ChatUI({ onSubmit });

    const sendBtn = chat.shadow.querySelector('.awi-input button') as HTMLButtonElement;
    sendBtn.click();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('updates badge text and class', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });

    chat.setBadge('Ollama', true);
    const badge = chat.shadow.querySelector('.awi-badge') as HTMLElement;
    expect(badge.textContent).toBe('Ollama');
    expect(badge.classList.contains('offline')).toBe(false);

    chat.setBadge('offline', false);
    expect(badge.textContent).toBe('offline');
    expect(badge.classList.contains('offline')).toBe(true);
  });

  it('enables and disables input', () => {
    const chat = new ChatUI({ onSubmit: vi.fn() });
    const input = chat.shadow.querySelector('.awi-input input') as HTMLInputElement;
    const sendBtn = chat.shadow.querySelector('.awi-input button') as HTMLButtonElement;

    chat.setEnabled(false);
    expect(input.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);

    chat.setEnabled(true);
    expect(input.disabled).toBe(false);
    expect(sendBtn.disabled).toBe(false);
  });
});
