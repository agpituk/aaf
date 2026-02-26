import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalPlanner } from './planner.js';
import type { ActionCatalog } from '@agent-accessibility-framework/runtime-core';

// Mock the OllamaClient
vi.mock('./ollama-client.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    generate: vi.fn(),
  })),
}));

const CATALOG: ActionCatalog = {
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
      statuses: [],
    },
  ],
  url: 'http://localhost:5173/invoices/new',
  timestamp: '2024-01-01T00:00:00.000Z',
};

describe('LocalPlanner', () => {
  let planner: LocalPlanner;
  let mockGenerate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { OllamaClient } = await import('./ollama-client.js');
    mockGenerate = vi.fn();
    (OllamaClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      generate: mockGenerate,
    }));
    planner = new LocalPlanner();
  });

  it('returns a valid PlannerRequest on successful plan', async () => {
    mockGenerate.mockResolvedValue(
      '{"action": "invoice.create", "args": {"customer_email": "alice@example.com", "amount": 120, "currency": "EUR"}}'
    );

    const result = await planner.plan('Create an invoice for alice@example.com', CATALOG);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args.customer_email).toBe('alice@example.com');
  });

  it('retries on parse failure and succeeds', async () => {
    mockGenerate
      .mockResolvedValueOnce('This is not valid JSON at all')
      .mockResolvedValue('{"action": "invoice.create", "args": {"customer_email": "a@b.com", "amount": 1, "currency": "EUR"}}');

    const result = await planner.plan('Create invoice', CATALOG);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries', async () => {
    mockGenerate.mockResolvedValue('not json');

    await expect(planner.plan('Create invoice', CATALOG)).rejects.toThrow('Planner failed after');
  });

  it('does not retry on Ollama API errors', async () => {
    mockGenerate.mockRejectedValue(new Error('Ollama API error: 500 Internal Server Error'));

    await expect(planner.plan('Create invoice', CATALOG)).rejects.toThrow('Ollama API error');
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('passes system prompt with action catalog to Ollama', async () => {
    mockGenerate.mockResolvedValue('{"action": "invoice.create", "args": {"customer_email": "a@b.com", "amount": 1, "currency": "EUR"}}');

    await planner.plan('Create invoice', CATALOG);

    const [userPrompt, systemPrompt] = mockGenerate.mock.calls[0];
    expect(systemPrompt).toContain('invoice.create');
    expect(systemPrompt).toContain('customer_email');
    expect(userPrompt).toContain('Create invoice');
  });
});
