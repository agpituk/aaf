import { describe, it, expect } from 'vitest';
import { PolicyEngine, ManifestValidator, type AgentManifest } from '@agent-native-web/runtime-core';

const policy = new PolicyEngine();
const validator = new ManifestValidator();

const MANIFEST: AgentManifest = {
  version: '0.1',
  site: { name: 'Test', origin: 'http://localhost' },
  actions: {
    'invoice.create': {
      title: 'Create invoice',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'optional',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['customer_email', 'amount', 'currency'],
        properties: {
          customer_email: { type: 'string', format: 'email' },
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', enum: ['EUR', 'USD'] },
        },
      },
      outputSchema: { type: 'object', properties: {} },
    },
  },
};

/**
 * Missing fields benchmark: omitting required fields MUST produce errors.
 */
describe('missing fields benchmark', () => {
  it('policy blocks when required field is missing', () => {
    const action = validator.getAction(MANIFEST, 'invoice.create');
    const result = policy.checkExecution(action, {
      requiredFields: { customer_email: 'a@b.com' },
      // missing: amount, currency
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('missing');
  });

  it('policy blocks when required field is empty string', () => {
    const action = validator.getAction(MANIFEST, 'invoice.create');
    const result = policy.checkExecution(action, {
      requiredFields: { customer_email: '', amount: 120, currency: 'EUR' },
    });
    expect(result.allowed).toBe(false);
  });

  it('validator rejects missing required fields', () => {
    const action = validator.getAction(MANIFEST, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'a@b.com',
      // missing: amount, currency
    });
    expect(result.valid).toBe(false);
  });

  it('validator rejects wrong type for required field', () => {
    const action = validator.getAction(MANIFEST, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'a@b.com',
      amount: 'not-a-number',
      currency: 'EUR',
    });
    expect(result.valid).toBe(false);
  });

  it('validator accepts when all required fields present and valid', () => {
    const action = validator.getAction(MANIFEST, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'a@b.com',
      amount: 120,
      currency: 'EUR',
    });
    expect(result.valid).toBe(true);
  });
});
