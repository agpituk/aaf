import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readConfig, detectAvailableBackend } from './config.js';

describe('readConfig', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('reads from window.__AAF_CONFIG__', () => {
    (globalThis as any).window = {
      __AAF_CONFIG__: {
        llm: { provider: 'openai', baseUrl: 'https://api.openai.com', model: 'gpt-4', apiKey: 'sk-test' },
      },
    };
    (globalThis as any).document = { querySelectorAll: () => [] };

    const config = readConfig();
    expect(config.llm?.provider).toBe('openai');
    expect(config.llm?.apiKey).toBe('sk-test');

    delete (globalThis as any).document;
  });

  it('reads from script data attributes when no global config', () => {
    (globalThis as any).window = {};
    (globalThis as any).document = {
      querySelectorAll: (selector: string) => {
        if (selector === 'script[data-llm-provider]') {
          return [{
            dataset: {
              llmProvider: 'ollama',
              llmBaseUrl: 'http://localhost:11434',
              llmModel: 'mistral',
            },
          }];
        }
        return [];
      },
    };

    const config = readConfig();
    expect(config.llm?.provider).toBe('ollama');
    expect(config.llm?.model).toBe('mistral');

    delete (globalThis as any).document;
  });

  it('returns empty config when no sources available', () => {
    (globalThis as any).window = {};
    (globalThis as any).document = {
      querySelectorAll: () => [],
    };

    const config = readConfig();
    expect(config.llm).toBeUndefined();

    delete (globalThis as any).document;
  });
});

describe('detectAvailableBackend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns OllamaBackend when Ollama is available and no config', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    const backend = await detectAvailableBackend({});
    expect(backend).not.toBeNull();
    expect(backend!.name()).toBe('Ollama');

    fetchSpy.mockRestore();
  });

  it('returns null when nothing is available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'));

    const backend = await detectAvailableBackend({});
    expect(backend).toBeNull();

    fetchSpy.mockRestore();
  });

  it('returns OpenAiCompatibleBackend when configured and available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":[]}', { status: 200 }),
    );

    const backend = await detectAvailableBackend({
      llm: { provider: 'openai', baseUrl: 'https://api.openai.com', model: 'gpt-4', apiKey: 'sk-test' },
    });
    expect(backend).not.toBeNull();
    expect(backend!.name()).toBe('OpenAI');

    fetchSpy.mockRestore();
  });

  it('falls back to Ollama when OpenAI is configured but unavailable', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      callCount++;
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('openai.com')) {
        throw new Error('unreachable');
      }
      if (url.includes('localhost:11434')) {
        return new Response('{}', { status: 200 });
      }
      throw new Error('unexpected');
    });

    const backend = await detectAvailableBackend({
      llm: { provider: 'openai', baseUrl: 'https://api.openai.com', model: 'gpt-4', apiKey: 'sk-test' },
    });
    expect(backend).not.toBeNull();
    expect(backend!.name()).toBe('Ollama');

    fetchSpy.mockRestore();
  });
});
