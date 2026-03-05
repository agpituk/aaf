import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaBackend } from './ollama-backend.js';
import type { ToolDefinition } from './types.js';

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'invoice_create',
      description: 'Create invoice',
      parameters: {
        type: 'object',
        properties: {
          customer_email: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['customer_email', 'amount'],
      },
    },
  },
];

describe('OllamaBackend.generateWithTools', () => {
  let backend: OllamaBackend;

  beforeEach(() => {
    backend = new OllamaBackend('http://localhost:11434', 'llama3.2');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends tools to /api/chat and returns tool call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            function: {
              name: 'invoice_create',
              arguments: { customer_email: 'test@example.com', amount: 100 },
            },
          }],
        },
      }), { status: 200 }),
    );

    const result = await backend.generateWithTools('create invoice for test@example.com', 'system', TOOLS);

    expect(result.toolCall).toBeDefined();
    expect(result.toolCall!.name).toBe('invoice_create');
    expect(result.toolCall!.arguments).toEqual({ customer_email: 'test@example.com', amount: 100 });
    expect(result.textResponse).toBeUndefined();

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.tools).toEqual(TOOLS);
    expect(body.messages).toHaveLength(2);
    expect(body.stream).toBe(false);
  });

  it('returns text response when LLM does not call a tool', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        message: {
          role: 'assistant',
          content: 'I can help you with that.',
        },
      }), { status: 200 }),
    );

    const result = await backend.generateWithTools('hello', 'system', TOOLS);

    expect(result.textResponse).toBe('I can help you with that.');
    expect(result.toolCall).toBeUndefined();
  });

  it('throws on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(backend.generateWithTools('test', 'system', TOOLS))
      .rejects.toThrow('Ollama API error: 500 Internal Server Error');
  });
});
