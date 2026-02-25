import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// We test the harbor-bridge CustomEvent protocol by simulating both sides
// in jsdom. The bridge sends awi-harbor-request and listens for awi-harbor-response.

describe('harbor-bridge', () => {
  let dom: JSDOM;
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:3000',
      runScripts: 'dangerously',
    });

    // Mock browser.runtime.getURL for the bridge's page script injection
    (globalThis as Record<string, unknown>).browser = {
      runtime: {
        getURL: (path: string) => `moz-extension://test-id/${path}`,
      },
    };

    // cloneInto is not available in jsdom — bridge feature-detects this
    // so we don't need to mock it

    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    // Override globals for the bridge module
    Object.defineProperty(globalThis, 'document', {
      value: dom.window.document,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: dom.window,
      writable: true,
      configurable: true,
    });
    // CustomEvent may not exist on jsdom globalThis
    (globalThis as Record<string, unknown>).CustomEvent = dom.window.CustomEvent;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    delete (globalThis as Record<string, unknown>).browser;
    delete (globalThis as Record<string, unknown>).CustomEvent;
    vi.restoreAllMocks();
  });

  it('sends request and receives response via CustomEvents', async () => {
    // Dynamic import so module runs with our mocked globals
    const { generate } = await import('./harbor-bridge.js');

    // Simulate page script: listen for requests, respond
    dom.window.document.addEventListener('awi-harbor-request', ((event: CustomEvent) => {
      const { requestId, userPrompt, systemPrompt } = event.detail;
      expect(userPrompt).toBe('Create an invoice');
      expect(systemPrompt).toBe('You are an agent');

      dom.window.document.dispatchEvent(
        new dom.window.CustomEvent('awi-harbor-response', {
          detail: { requestId, result: '{"action":"invoice.create","args":{}}' },
        })
      );
    }) as EventListener);

    const result = await generate('Create an invoice', 'You are an agent');
    expect(result).toBe('{"action":"invoice.create","args":{}}');
  });

  it('rejects when page script returns error', async () => {
    // Reset module state for fresh import
    vi.resetModules();
    const { generate } = await import('./harbor-bridge.js');

    dom.window.document.addEventListener('awi-harbor-request', ((event: CustomEvent) => {
      const { requestId } = event.detail;
      dom.window.document.dispatchEvent(
        new dom.window.CustomEvent('awi-harbor-response', {
          detail: { requestId, error: 'Harbor not available: window.ai.languageModel not found' },
        })
      );
    }) as EventListener);

    await expect(generate('test', 'system')).rejects.toThrow('Harbor not available');
  });

  it('ignores unrelated responses (wrong requestId)', async () => {
    vi.resetModules();
    const { generate } = await import('./harbor-bridge.js');

    dom.window.document.addEventListener('awi-harbor-request', ((event: CustomEvent) => {
      const { requestId } = event.detail;

      // First: send an unrelated response with wrong requestId
      dom.window.document.dispatchEvent(
        new dom.window.CustomEvent('awi-harbor-response', {
          detail: { requestId: 'wrong-id', result: 'wrong' },
        })
      );

      // Then: send the correct response
      dom.window.document.dispatchEvent(
        new dom.window.CustomEvent('awi-harbor-response', {
          detail: { requestId, result: 'correct' },
        })
      );
    }) as EventListener);

    const result = await generate('test', 'system');
    expect(result).toBe('correct');
  });

  it('injects page script element into document head', async () => {
    vi.resetModules();
    const { generate } = await import('./harbor-bridge.js');

    // Set up auto-responder
    dom.window.document.addEventListener('awi-harbor-request', ((event: CustomEvent) => {
      dom.window.document.dispatchEvent(
        new dom.window.CustomEvent('awi-harbor-response', {
          detail: { requestId: event.detail.requestId, result: 'ok' },
        })
      );
    }) as EventListener);

    await generate('test', 'system');

    const scripts = dom.window.document.head.querySelectorAll('script');
    const harborScript = Array.from(scripts).find((s) =>
      s.src.includes('harbor-page-script.js')
    );
    expect(harborScript).toBeDefined();
    expect(harborScript!.type).toBe('module');
  });

  it('only injects page script once across multiple calls', async () => {
    vi.resetModules();
    const { generate } = await import('./harbor-bridge.js');

    dom.window.document.addEventListener('awi-harbor-request', ((event: CustomEvent) => {
      dom.window.document.dispatchEvent(
        new dom.window.CustomEvent('awi-harbor-response', {
          detail: { requestId: event.detail.requestId, result: 'ok' },
        })
      );
    }) as EventListener);

    await generate('first', 'system');
    await generate('second', 'system');

    const scripts = dom.window.document.head.querySelectorAll('script[src*="harbor-page-script"]');
    expect(scripts.length).toBe(1);
  });
});
