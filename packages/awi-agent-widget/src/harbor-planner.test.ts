import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HarborPlanner } from './harbor-planner.js';
import type { ActionCatalog } from '@agent-native-web/runtime-core';

const mockCatalog: ActionCatalog = {
  actions: [
    {
      action: 'invoice.create',
      kind: 'action',
      danger: 'low',
      confirm: 'optional',
      scope: 'invoices.write',
      fields: [
        { field: 'customer_email', tagName: 'input' },
        { field: 'amount', tagName: 'input' },
        { field: 'currency', tagName: 'select' },
      ],
      statuses: [{ output: 'invoice.create.status', tagName: 'div' }],
      submitAction: 'invoice.create.submit',
    },
  ],
  url: 'http://localhost:5173/invoices/new',
  timestamp: '2026-01-01T00:00:00.000Z',
};

function makeHarborResponse(json: object): string {
  return JSON.stringify(json);
}

describe('HarborPlanner', () => {
  let planner: HarborPlanner;

  beforeEach(() => {
    planner = new HarborPlanner();
    // Clear any previous mock
    delete (globalThis as Record<string, unknown>).ai;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).ai;
    vi.restoreAllMocks();
  });

  it('plans correctly with Harbor (window.ai) available', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue(
        makeHarborResponse({ action: 'invoice.create', args: { customer_email: 'alice@test.com', amount: 100, currency: 'EUR' } }),
      ),
      destroy: vi.fn(),
    };

    (globalThis as Record<string, unknown>).ai = {
      createTextSession: vi.fn().mockResolvedValue(mockSession),
    };

    const result = await planner.plan('Create an invoice for alice@test.com for 100 EUR', mockCatalog);

    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args.customer_email).toBe('alice@test.com');
    expect(result.request.args.amount).toBe(100);
    expect(mockSession.prompt).toHaveBeenCalledOnce();
    expect(mockSession.destroy).toHaveBeenCalledOnce();
  });

  it('passes system prompt to Harbor session', async () => {
    const createTextSession = vi.fn().mockResolvedValue({
      prompt: vi.fn().mockResolvedValue(
        makeHarborResponse({ action: 'invoice.create', args: { customer_email: 'a@b.com', amount: 1, currency: 'EUR' } }),
      ),
      destroy: vi.fn(),
    });

    (globalThis as Record<string, unknown>).ai = { createTextSession };

    await planner.plan('Create invoice', mockCatalog);

    expect(createTextSession).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: expect.stringContaining('invoice.create') }),
    );
  });

  it('falls back to Ollama when no window.ai', async () => {
    // No window.ai set
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Mock Ollama tags check
    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/tags')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/api/generate')) {
        return new Response(
          JSON.stringify({
            response: makeHarborResponse({ action: 'invoice.create', args: { customer_email: 'b@c.com', amount: 50, currency: 'USD' } }),
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    const result = await planner.plan('Create invoice for b@c.com for 50 USD', mockCatalog);

    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args.amount).toBe(50);
    fetchSpy.mockRestore();
  });

  it('retries on parse failure', async () => {
    let callCount = 0;
    const mockSession = {
      prompt: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return 'not valid json at all';
        return makeHarborResponse({ action: 'invoice.create', args: { customer_email: 'x@y.com', amount: 10, currency: 'EUR' } });
      }),
      destroy: vi.fn(),
    };

    (globalThis as Record<string, unknown>).ai = {
      createTextSession: vi.fn().mockResolvedValue(mockSession),
    };

    const result = await planner.plan('Create invoice', mockCatalog);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(callCount).toBe(2);
  });

  it('rejects selector-containing responses', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue(
        makeHarborResponse({ action: 'invoice.create', args: { customer_email: '#email-field' } }),
      ),
      destroy: vi.fn(),
    };

    (globalThis as Record<string, unknown>).ai = {
      createTextSession: vi.fn().mockResolvedValue(mockSession),
    };

    await expect(planner.plan('Create invoice', mockCatalog)).rejects.toThrow('selector');
  });

  it('handles "none" action responses', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue(
        makeHarborResponse({ action: 'none', args: {}, error: 'Cannot map to any action' }),
      ),
      destroy: vi.fn(),
    };

    (globalThis as Record<string, unknown>).ai = {
      createTextSession: vi.fn().mockResolvedValue(mockSession),
    };

    await expect(planner.plan('Do something impossible', mockCatalog)).rejects.toThrow('Cannot map to any action');
  });

  it('throws when no LLM backend is available', async () => {
    // No window.ai, and mock fetch to fail for Ollama
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(planner.plan('Create invoice', mockCatalog)).rejects.toThrow('No LLM backend');
    fetchSpy.mockRestore();
  });

  it('detectBackend returns "harbor" when window.ai exists', async () => {
    (globalThis as Record<string, unknown>).ai = {
      createTextSession: vi.fn(),
    };

    const result = await planner.detectBackend();
    expect(result).toBe('harbor');
  });

  it('detectBackend returns "ollama" when Ollama is reachable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    const result = await planner.detectBackend();
    expect(result).toBe('ollama');
    fetchSpy.mockRestore();
  });

  it('detectBackend returns "none" when nothing available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'));

    const result = await planner.detectBackend();
    expect(result).toBe('none');
    fetchSpy.mockRestore();
  });

  describe('query()', () => {
    it('returns natural language answer via Harbor', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('Yes, alejandro@mozilla.ai has 2 invoices.'),
        destroy: vi.fn(),
      };

      (globalThis as Record<string, unknown>).ai = {
        createTextSession: vi.fn().mockResolvedValue(mockSession),
      };

      const context = 'ID: 1, Customer: alejandro@mozilla.ai, Amount: 100 USD\nID: 2, Customer: alejandro@mozilla.ai, Amount: 50 EUR';
      const result = await planner.query('Does alejandro@mozilla.ai have any invoices?', context);

      expect(result).toBe('Yes, alejandro@mozilla.ai has 2 invoices.');
      expect(mockSession.prompt).toHaveBeenCalledWith('Does alejandro@mozilla.ai have any invoices?');
      expect(mockSession.destroy).toHaveBeenCalledOnce();
    });

    it('passes page data in system prompt to Harbor', async () => {
      const createTextSession = vi.fn().mockResolvedValue({
        prompt: vi.fn().mockResolvedValue('No matching records.'),
        destroy: vi.fn(),
      });

      (globalThis as Record<string, unknown>).ai = { createTextSession };

      await planner.query('Any invoices?', 'ID: 1, Customer: bob@test.com');

      expect(createTextSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('bob@test.com'),
        }),
      );
    });

    it('falls back to Ollama without json format', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tags')) {
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/generate')) {
          // Verify the request body does NOT contain format: 'json'
          return new Response(
            JSON.stringify({ response: 'Yes, there are 2 invoices.' }),
            { status: 200 },
          );
        }
        return new Response('', { status: 404 });
      });

      const result = await planner.query('Any invoices?', 'some data');
      expect(result).toBe('Yes, there are 2 invoices.');

      // Verify Ollama was called without format: 'json'
      const generateCall = fetchSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/generate'),
      );
      expect(generateCall).toBeDefined();
      const body = JSON.parse((generateCall![1] as RequestInit).body as string);
      expect(body.format).toBeUndefined();

      fetchSpy.mockRestore();
    });

    it('throws when no LLM backend is available', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(planner.query('Any data?', 'some context')).rejects.toThrow('No LLM backend');
      fetchSpy.mockRestore();
    });
  });
});
