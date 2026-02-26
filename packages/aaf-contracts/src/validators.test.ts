import { describe, it, expect } from 'vitest';
import { validatePlannerRequest, validateRuntimeResponse } from './validators.js';

describe('validatePlannerRequest', () => {
  it('accepts a valid request with action and args', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: { customer_email: 'alice@example.com', amount: 120, currency: 'EUR' },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a valid request with confirmed flag', () => {
    const result = validatePlannerRequest({
      action: 'workspace.delete',
      args: { delete_confirmation_text: 'DELETE' },
      confirmed: true,
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a request with empty args', () => {
    const result = validatePlannerRequest({
      action: 'invoice.list',
      args: {},
    });
    expect(result.valid).toBe(true);
  });

  it('rejects null input', () => {
    const result = validatePlannerRequest(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('non-null object');
  });

  it('rejects non-object input', () => {
    const result = validatePlannerRequest('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects missing action field', () => {
    const result = validatePlannerRequest({ args: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('action'))).toBe(true);
  });

  it('rejects missing args field', () => {
    const result = validatePlannerRequest({ action: 'invoice.create' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('args'))).toBe(true);
  });

  it('rejects action name without dot separator', () => {
    const result = validatePlannerRequest({
      action: 'invoicecreate',
      args: {},
    });
    expect(result.valid).toBe(false);
  });

  it('rejects action name starting with uppercase', () => {
    const result = validatePlannerRequest({
      action: 'Invoice.create',
      args: {},
    });
    expect(result.valid).toBe(false);
  });

  it('rejects CSS class selector in args', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: { customer_email: '.email-input' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('CSS selector');
  });

  it('rejects CSS ID selector in args', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: { customer_email: '#email-field' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('CSS selector');
  });

  it('rejects attribute selector in args', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: { customer_email: '[data-field=email]' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('CSS selector');
  });

  it('rejects additional properties', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: {},
      selector: '#submit-btn',
    });
    expect(result.valid).toBe(false);
  });

  it('allows normal string values that are not selectors', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: { customer_email: 'alice@example.com', memo: 'Payment for services' },
    });
    expect(result.valid).toBe(true);
  });

  it('allows numeric values in args', () => {
    const result = validatePlannerRequest({
      action: 'invoice.create',
      args: { amount: 120 },
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateRuntimeResponse', () => {
  it('accepts a valid completed response', () => {
    const result = validateRuntimeResponse({
      status: 'completed',
      action: 'invoice.create',
      result: 'Invoice INV-001 created',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a needs_confirmation response with metadata', () => {
    const result = validateRuntimeResponse({
      status: 'needs_confirmation',
      action: 'workspace.delete',
      confirmation_metadata: {
        action: 'workspace.delete',
        risk: 'high',
        scope: 'workspace.delete',
        title: 'Delete workspace',
      },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects needs_confirmation without confirmation_metadata', () => {
    const result = validateRuntimeResponse({
      status: 'needs_confirmation',
      action: 'workspace.delete',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('confirmation_metadata');
  });

  it('accepts a validation_error response', () => {
    const result = validateRuntimeResponse({
      status: 'validation_error',
      action: 'invoice.create',
      error: 'Invalid email format',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts an execution_error response', () => {
    const result = validateRuntimeResponse({
      status: 'execution_error',
      action: 'invoice.create',
      error: 'Network error',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a missing_required_fields response with field list', () => {
    const result = validateRuntimeResponse({
      status: 'missing_required_fields',
      action: 'invoice.create',
      missing_fields: ['customer_email', 'amount'],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects missing_required_fields without missing_fields array', () => {
    const result = validateRuntimeResponse({
      status: 'missing_required_fields',
      action: 'invoice.create',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('missing_fields');
  });

  it('rejects missing_required_fields with empty missing_fields array', () => {
    const result = validateRuntimeResponse({
      status: 'missing_required_fields',
      action: 'invoice.create',
      missing_fields: [],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects null input', () => {
    const result = validateRuntimeResponse(null);
    expect(result.valid).toBe(false);
  });

  it('rejects missing status', () => {
    const result = validateRuntimeResponse({ action: 'invoice.create' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing action', () => {
    const result = validateRuntimeResponse({ status: 'completed' });
    expect(result.valid).toBe(false);
  });

  it('accepts an awaiting_review response', () => {
    const result = validateRuntimeResponse({
      status: 'awaiting_review',
      action: 'invoice.create',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid status value', () => {
    const result = validateRuntimeResponse({
      status: 'unknown_status',
      action: 'invoice.create',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects additional properties', () => {
    const result = validateRuntimeResponse({
      status: 'completed',
      action: 'invoice.create',
      extra_field: 'should not be here',
    });
    expect(result.valid).toBe(false);
  });
});
