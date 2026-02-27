import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaPlanner } from './ollama-planner.js';
import type { ActionCatalog } from '@agent-accessibility-framework/runtime-core';
import type { ManifestActionSummary, PageSummary } from '@agent-accessibility-framework/planner-local';

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

function makeOllamaResponse(json: object): string {
  return JSON.stringify(json);
}

describe('OllamaPlanner', () => {
  let planner: OllamaPlanner;

  beforeEach(() => {
    planner = new OllamaPlanner();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plans correctly with Ollama available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/tags')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/api/generate')) {
        return new Response(
          JSON.stringify({
            response: makeOllamaResponse({ action: 'invoice.create', args: { customer_email: 'alice@test.com', amount: 100, currency: 'EUR' } }),
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    const result = await planner.plan('Create an invoice for alice@test.com for 100 EUR', mockCatalog);

    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args.customer_email).toBe('alice@test.com');
    expect(result.request.args.amount).toBe(100);
    fetchSpy.mockRestore();
  });

  it('retries on parse failure', async () => {
    let generateCallCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/tags')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/api/generate')) {
        generateCallCount++;
        if (generateCallCount === 1) {
          return new Response(
            JSON.stringify({ response: 'not valid json at all' }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            response: makeOllamaResponse({ action: 'invoice.create', args: { customer_email: 'x@y.com', amount: 10, currency: 'EUR' } }),
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    const result = await planner.plan('Create invoice', mockCatalog);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(generateCallCount).toBe(2);
    fetchSpy.mockRestore();
  });

  it('rejects selector-containing responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/tags')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/api/generate')) {
        return new Response(
          JSON.stringify({
            response: makeOllamaResponse({ action: 'invoice.create', args: { customer_email: '#email-field' } }),
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    await expect(planner.plan('Create invoice', mockCatalog)).rejects.toThrow('selector');
    fetchSpy.mockRestore();
  });

  it('handles "none" action responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/tags')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/api/generate')) {
        return new Response(
          JSON.stringify({
            response: makeOllamaResponse({ action: 'none', args: {}, error: 'Cannot map to any action' }),
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    await expect(planner.plan('Do something impossible', mockCatalog)).rejects.toThrow('Cannot map to any action');
    fetchSpy.mockRestore();
  });

  it('throws when no LLM backend is available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(planner.plan('Create invoice', mockCatalog)).rejects.toThrow('No LLM backend');
    fetchSpy.mockRestore();
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
    it('returns natural language answer via Ollama', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tags')) {
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/generate')) {
          return new Response(
            JSON.stringify({ response: 'Yes, alejandro@mozilla.ai has 2 invoices.' }),
            { status: 200 },
          );
        }
        return new Response('', { status: 404 });
      });

      const context = 'ID: 1, Customer: alejandro@mozilla.ai, Amount: 100 USD\nID: 2, Customer: alejandro@mozilla.ai, Amount: 50 EUR';
      const result = await planner.query('Does alejandro@mozilla.ai have any invoices?', context);

      expect(result).toBe('Yes, alejandro@mozilla.ai has 2 invoices.');
      fetchSpy.mockRestore();
    });

    it('sends query without json format to Ollama', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tags')) {
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/generate')) {
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

  describe('planSiteAware()', () => {
    const otherPageActions: ManifestActionSummary[] = [
      {
        action: 'workspace.delete',
        title: 'Delete workspace',
        description: 'Permanently deletes the workspace.',
        page: '/settings/',
        pageTitle: 'Settings',
        risk: 'high',
        confirmation: 'required',
        fields: [{ name: 'delete_confirmation_text' }],
      },
    ];

    const pages: PageSummary[] = [
      { route: '/invoices/', title: 'Invoice List', description: 'All invoices', hasActions: false, hasData: true },
      { route: '/settings/', title: 'Settings', hasActions: true, hasData: false },
    ];

    it('plans with site-aware context including off-page actions', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tags')) {
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/generate')) {
          return new Response(
            JSON.stringify({
              response: makeOllamaResponse({ action: 'workspace.delete', args: { delete_confirmation_text: 'DELETE' } }),
            }),
            { status: 200 },
          );
        }
        return new Response('', { status: 404 });
      });

      const result = await planner.planSiteAware('Delete my workspace', mockCatalog, otherPageActions, pages);

      expect(result.kind).toBe('action');
      if (result.kind !== 'action') throw new Error('unexpected');
      expect(result.request.action).toBe('workspace.delete');
      expect(result.request.args.delete_confirmation_text).toBe('DELETE');
      fetchSpy.mockRestore();
    });

    it('includes off-page actions in the system prompt sent to Ollama', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tags')) {
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/generate')) {
          return new Response(
            JSON.stringify({
              response: makeOllamaResponse({ action: 'invoice.create', args: { customer_email: 'a@b.com', amount: 1, currency: 'EUR' } }),
            }),
            { status: 200 },
          );
        }
        return new Response('', { status: 404 });
      });

      await planner.planSiteAware('Create invoice', mockCatalog, otherPageActions, pages);

      // Verify the system prompt includes off-page action info
      const generateCall = fetchSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/generate'),
      );
      expect(generateCall).toBeDefined();
      const body = JSON.parse((generateCall![1] as RequestInit).body as string);
      expect(body.system).toContain('workspace.delete');
      expect(body.system).toContain('/settings/');
      expect(body.system).toContain('navigation');

      fetchSpy.mockRestore();
    });

    it('retries on parse failure', async () => {
      let generateCallCount = 0;
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tags')) {
          return new Response('{}', { status: 200 });
        }
        if (url.includes('/api/generate')) {
          generateCallCount++;
          if (generateCallCount === 1) {
            return new Response(
              JSON.stringify({ response: 'not valid json' }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              response: makeOllamaResponse({ action: 'workspace.delete', args: { delete_confirmation_text: 'DELETE' } }),
            }),
            { status: 200 },
          );
        }
        return new Response('', { status: 404 });
      });

      const result = await planner.planSiteAware('Delete workspace', mockCatalog, otherPageActions, pages);
      expect(result.kind).toBe('action');
      expect(generateCallCount).toBe(2);
      fetchSpy.mockRestore();
    });

    it('throws when no LLM backend is available', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(planner.planSiteAware('Delete workspace', mockCatalog, otherPageActions, pages)).rejects.toThrow('No LLM backend');
      fetchSpy.mockRestore();
    });
  });
});
