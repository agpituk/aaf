import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAiCompatibleBackend } from './openai-backend.js';

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
});
