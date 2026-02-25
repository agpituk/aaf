import { describe, it, expect } from 'vitest';
import { ManifestValidator } from './manifest-validator.js';
import type { AgentManifest } from './types.js';

const testManifest: AgentManifest = {
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
          memo: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
        },
      },
    },
  },
};

describe('ManifestValidator', () => {
  const validator = new ManifestValidator();

  it('loads a valid manifest', () => {
    const manifest = validator.loadManifest(testManifest);
    expect(manifest.version).toBe('0.1');
    expect(manifest.site.name).toBe('Test');
  });

  it('throws on null input', () => {
    expect(() => validator.loadManifest(null)).toThrow('non-null object');
  });

  it('throws on missing required fields', () => {
    expect(() => validator.loadManifest({ version: '0.1' })).toThrow('missing required fields');
  });

  it('retrieves an action by name', () => {
    const action = validator.getAction(testManifest, 'invoice.create');
    expect(action.title).toBe('Create invoice');
  });

  it('throws for unknown action names', () => {
    expect(() => validator.getAction(testManifest, 'unknown.action')).toThrow('not found');
  });

  it('validates valid input', () => {
    const action = validator.getAction(testManifest, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'alice@example.com',
      amount: 120,
      currency: 'EUR',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects input with missing required field', () => {
    const action = validator.getAction(testManifest, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'alice@example.com',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects input with invalid email format', () => {
    const action = validator.getAction(testManifest, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'not-an-email',
      amount: 120,
      currency: 'EUR',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects input with invalid enum value', () => {
    const action = validator.getAction(testManifest, 'invoice.create');
    const result = validator.validateInput(action, {
      customer_email: 'alice@example.com',
      amount: 120,
      currency: 'GBP',
    });
    expect(result.valid).toBe(false);
  });

  describe('coerceAndValidate', () => {
    it('coerces string amount and enum case, then validates successfully', () => {
      const action = validator.getAction(testManifest, 'invoice.create');
      const result = validator.coerceAndValidate(action, {
        customer_email: 'alice@example.com',
        amount: '150',
        currency: 'eur',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.coerced.amount).toBe(150);
      expect(result.coerced.currency).toBe('EUR');
      expect(result.coercions.length).toBeGreaterThan(0);
    });

    it('coerces but still fails validation when value is invalid', () => {
      const action = validator.getAction(testManifest, 'invoice.create');
      const result = validator.coerceAndValidate(action, {
        customer_email: 'not-an-email',
        amount: '150',
        currency: 'eur',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Coercion still happened for amount and currency
      expect(result.coerced.amount).toBe(150);
      expect(result.coerced.currency).toBe('EUR');
    });

    it('returns empty coercions when no coercion needed', () => {
      const action = validator.getAction(testManifest, 'invoice.create');
      const result = validator.coerceAndValidate(action, {
        customer_email: 'alice@example.com',
        amount: 120,
        currency: 'EUR',
      });
      expect(result.valid).toBe(true);
      expect(result.coercions).toHaveLength(0);
    });
  });
});
