import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAiCompatibleBackend } from './openai-backend.js';
import type { ToolDefinition } from './types.js';

describe('OpenAiCompatibleBackend', () => {
  let backend: OpenAiCompatibleBackend;

  beforeEach(() => {
    backend = new OpenAiCompatibleBackend({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-test',
      model: 'gpt-4',
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct request to /v1/chat/completions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: '{"action":"test","args":{}}' } }],
      }), { status: 200 }),
    );

    const result = await backend.generate('user prompt', 'system prompt');

    expect(result).toBe('{"action":"test","args":{}}');

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.model).toBe('gpt-4');
    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);
    expect(body.response_format).toEqual({ type: 'json_object' });

    fetchSpy.mockRestore();
  });

  it('omits response_format when json=false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: 'Plain text answer' } }],
      }), { status: 200 }),
    );

    const result = await backend.generate('question', 'context', { json: false });

    expect(result).toBe('Plain text answer');
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.response_format).toBeUndefined();

    fetchSpy.mockRestore();
  });

  it('throws on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );

    await expect(backend.generate('test', 'test')).rejects.toThrow('OpenAI API error: 401 Unauthorized');
  });

  it('isAvailable checks /v1/models', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":[]}', { status: 200 }),
    );

    const available = await backend.isAvailable();
    expect(available).toBe(true);

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe('https://api.openai.com/v1/models');

    fetchSpy.mockRestore();
  });

  it('isAvailable returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const available = await backend.isAvailable();
    expect(available).toBe(false);
  });

  it('name returns OpenAI', () => {
    expect(backend.name()).toBe('OpenAI');
  });

  it('strips trailing slash from baseUrl', async () => {
    const b = new OpenAiCompatibleBackend({
      baseUrl: 'https://api.openai.com/',
      apiKey: 'sk-test',
      model: 'gpt-4',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: '{}' } }],
      }), { status: 200 }),
    );

    await b.generate('test', 'test');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');

    fetchSpy.mockRestore();
  });

  describe('generateWithTools', () => {
    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'invoice_create',
          description: 'Create invoice',
          parameters: { type: 'object', properties: { amount: { type: 'number' } } },
        },
      },
    ];

    it('sends tools parameter and returns tool call', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              tool_calls: [{
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'invoice_create',
                  arguments: '{"amount": 100}',
                },
              }],
            },
          }],
        }), { status: 200 }),
      );

      const result = await backend.generateWithTools('create invoice', 'system', tools);

      expect(result.toolCall).toBeDefined();
      expect(result.toolCall!.name).toBe('invoice_create');
      expect(result.toolCall!.arguments).toEqual({ amount: 100 });
      expect(result.textResponse).toBeUndefined();

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.tools).toEqual(tools);
      expect(body.response_format).toBeUndefined(); // no JSON format with tools
    });

    it('returns text response when no tool called', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Sure, I can help.',
            },
          }],
        }), { status: 200 }),
      );

      const result = await backend.generateWithTools('hello', 'system', tools);

      expect(result.textResponse).toBe('Sure, I can help.');
      expect(result.toolCall).toBeUndefined();
    });

    it('handles pre-parsed arguments object', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  name: 'invoice_create',
                  arguments: { amount: 50 }, // already an object, not a string
                },
              }],
            },
          }],
        }), { status: 200 }),
      );

      const result = await backend.generateWithTools('test', 'system', tools);
      expect(result.toolCall!.arguments).toEqual({ amount: 50 });
    });

    it('throws on API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
      );

      await expect(backend.generateWithTools('test', 'system', tools))
        .rejects.toThrow('OpenAI API error: 401 Unauthorized');
    });
  });
});
