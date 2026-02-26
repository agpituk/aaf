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
