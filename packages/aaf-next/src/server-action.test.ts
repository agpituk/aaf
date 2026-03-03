import { describe, it, expect } from 'vitest';
import { withAgentAction, generateManifestFragment } from './server-action.js';

describe('withAgentAction', () => {
  it('returns the original function with metadata attached', () => {
    const original = async (data: any) => ({ ok: true });
    const wrapped = withAgentAction(original, {
      action: 'test.action',
      risk: 'low',
      scope: 'test.write',
    });

    expect(wrapped.__aaf_meta.action).toBe('test.action');
    expect(wrapped.__aaf_meta.risk).toBe('low');
    // Original function still works
    expect(wrapped({ input: 'data' })).resolves.toEqual({ ok: true });
  });
});

describe('generateManifestFragment', () => {
  it('generates actions from registered withAgentAction calls', () => {
    // Register some actions
    withAgentAction(async () => ({}), {
      action: 'invoice.create',
      risk: 'low',
      confirmation: 'review',
      scope: 'invoices.write',
      idempotent: false,
      inputSchema: { type: 'object', properties: { email: { type: 'string' } } },
    });

    withAgentAction(async () => ({}), {
      action: 'invoice.delete',
      risk: 'high',
      confirmation: 'required',
      scope: 'invoices.admin',
    });

    const fragment = generateManifestFragment();

    expect(fragment.actions['invoice.create']).toBeDefined();
    expect(fragment.actions['invoice.create'].risk).toBe('low');
    expect(fragment.actions['invoice.create'].scope).toBe('invoices.write');
    expect(fragment.actions['invoice.delete']).toBeDefined();
    expect(fragment.actions['invoice.delete'].risk).toBe('high');
    expect(fragment.actions['invoice.delete'].confirmation).toBe('required');
  });
});
