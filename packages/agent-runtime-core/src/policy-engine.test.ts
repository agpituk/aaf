import { describe, it, expect } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import type { AgentAction } from './types.js';

const lowRiskAction: AgentAction = {
  title: 'Create invoice',
  scope: 'invoices.write',
  risk: 'low',
  confirmation: 'optional',
  idempotent: false,
  inputSchema: {
    type: 'object',
    required: ['customer_email'],
    properties: { customer_email: { type: 'string' } },
  },
  outputSchema: { type: 'object', properties: {} },
};

const highRiskAction: AgentAction = {
  title: 'Delete workspace',
  scope: 'workspace.delete',
  risk: 'high',
  confirmation: 'required',
  idempotent: false,
  inputSchema: {
    type: 'object',
    required: ['delete_confirmation_text'],
    properties: { delete_confirmation_text: { type: 'string' } },
  },
  outputSchema: { type: 'object', properties: {} },
};

describe('PolicyEngine', () => {
  const engine = new PolicyEngine();

  it('allows low-risk actions without confirmation', () => {
    const result = engine.checkExecution(lowRiskAction);
    expect(result.allowed).toBe(true);
  });

  it('blocks high-risk + confirmation=required without confirmation', () => {
    const result = engine.checkExecution(highRiskAction);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('high-risk');
    expect(result.reason).toContain('confirmation');
  });

  it('allows high-risk action when confirmed', () => {
    const result = engine.checkExecution(highRiskAction, { confirmed: true });
    expect(result.allowed).toBe(true);
  });

  it('blocks when required fields are missing', () => {
    const result = engine.checkExecution(lowRiskAction, {
      requiredFields: {},
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('customer_email');
  });

  it('allows when all required fields are present', () => {
    const result = engine.checkExecution(lowRiskAction, {
      requiredFields: { customer_email: 'test@test.com' },
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks when required field is empty string', () => {
    const result = engine.checkExecution(lowRiskAction, {
      requiredFields: { customer_email: '' },
    });
    expect(result.allowed).toBe(false);
  });

  it('allows confirmation: review actions (not blocked by policy)', () => {
    const reviewAction: AgentAction = {
      title: 'Create invoice',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'review',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['customer_email'],
        properties: { customer_email: { type: 'string' } },
      },
      outputSchema: { type: 'object', properties: {} },
    };
    const result = engine.checkExecution(reviewAction, {
      requiredFields: { customer_email: 'test@test.com' },
    });
    expect(result.allowed).toBe(true);
  });
});

describe('PolicyEngine.checkArgSafety', () => {
  const engine = new PolicyEngine();

  it('allows normal string args', () => {
    const result = engine.checkArgSafety({ customer_email: 'test@example.com', amount: '100' });
    expect(result.allowed).toBe(true);
  });

  it('allows numeric and boolean args', () => {
    const result = engine.checkArgSafety({ amount: 42, active: true });
    expect(result.allowed).toBe(true);
  });

  it('rejects CSS class selector in args', () => {
    const result = engine.checkArgSafety({ target: '.btn-primary' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('selector-like');
  });

  it('rejects CSS ID selector in args', () => {
    const result = engine.checkArgSafety({ target: '#submit-btn' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('selector-like');
  });

  it('rejects attribute selector in args', () => {
    const result = engine.checkArgSafety({ field: '[data-id=123]' });
    expect(result.allowed).toBe(false);
  });

  it('rejects child combinator in args', () => {
    const result = engine.checkArgSafety({ path: 'form > input' });
    expect(result.allowed).toBe(false);
  });

  it('rejects pseudo-class selectors', () => {
    const result = engine.checkArgSafety({ selector: ':nth-child(2)' });
    expect(result.allowed).toBe(false);
  });

  it('rejects XPath expressions', () => {
    const result = engine.checkArgSafety({ path: '//div[@class="form"]' });
    expect(result.allowed).toBe(false);
  });

  it('rejects tag selectors with qualifiers', () => {
    const result = engine.checkArgSafety({ el: 'div.container' });
    expect(result.allowed).toBe(false);
  });

  it('rejects selectors in nested objects', () => {
    const result = engine.checkArgSafety({ nested: { target: '#evil' } });
    expect(result.allowed).toBe(false);
  });
});

describe('PolicyEngine.checkOriginTrust', () => {
  const engine = new PolicyEngine();

  it('allows matching origins', () => {
    const result = engine.checkOriginTrust('https://example.com', 'https://example.com');
    expect(result.allowed).toBe(true);
  });

  it('blocks mismatched origins', () => {
    const result = engine.checkOriginTrust('https://evil.com', 'https://example.com');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('evil.com');
    expect(result.reason).toContain('example.com');
  });

  it('blocks when protocols differ', () => {
    const result = engine.checkOriginTrust('http://example.com', 'https://example.com');
    expect(result.allowed).toBe(false);
  });

  it('blocks when ports differ', () => {
    const result = engine.checkOriginTrust('https://example.com:8080', 'https://example.com:3000');
    expect(result.allowed).toBe(false);
  });
});

describe('PolicyEngine.checkScope', () => {
  const engine = new PolicyEngine();

  it('allows when agent has required scope', () => {
    const result = engine.checkScope('invoices.write', ['invoices.read', 'invoices.write']);
    expect(result.allowed).toBe(true);
  });

  it('blocks when agent lacks required scope', () => {
    const result = engine.checkScope('workspace.delete', ['invoices.read', 'invoices.write']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('workspace.delete');
  });

  it('blocks when agent has no scopes', () => {
    const result = engine.checkScope('invoices.write', []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('(none)');
  });
});

describe('PolicyEngine.checkExecution with new options', () => {
  const engine = new PolicyEngine();

  it('blocks when args contain selectors via checkExecution', () => {
    const result = engine.checkExecution(lowRiskAction, {
      args: { customer_email: '#email-input' },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('selector-like');
  });

  it('blocks on origin mismatch via checkExecution', () => {
    const result = engine.checkExecution(lowRiskAction, {
      manifestOrigin: 'https://evil.com',
      pageOrigin: 'https://example.com',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('origin');
  });

  it('blocks on scope mismatch via checkExecution', () => {
    const result = engine.checkExecution(lowRiskAction, {
      agentScopes: ['settings.read'],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('invoices.write');
  });

  it('allows when all checks pass', () => {
    const result = engine.checkExecution(lowRiskAction, {
      requiredFields: { customer_email: 'test@test.com' },
      args: { customer_email: 'test@test.com' },
      manifestOrigin: 'https://example.com',
      pageOrigin: 'https://example.com',
      agentScopes: ['invoices.write', 'invoices.read'],
    });
    expect(result.allowed).toBe(true);
  });
});
