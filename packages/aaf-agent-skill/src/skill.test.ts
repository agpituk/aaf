import { describe, it, expect } from 'vitest';
import { getAnnotationRules, isValidActionName, isValidFieldName } from './skill.js';

describe('getAnnotationRules', () => {
  it('returns an array of rules', () => {
    const rules = getAnnotationRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('includes key rules', () => {
    const rules = getAnnotationRules();
    const joined = rules.join(' ');
    expect(joined).toContain('data-agent-kind');
    expect(joined).toContain('danger');
    expect(joined).toContain('snake_case');
  });
});

describe('isValidActionName', () => {
  it('accepts valid action names', () => {
    expect(isValidActionName('invoice.create')).toBe(true);
    expect(isValidActionName('user.delete')).toBe(true);
    expect(isValidActionName('invoice.create.submit')).toBe(true);
    expect(isValidActionName('workspace.settings.update')).toBe(true);
  });

  it('rejects invalid action names', () => {
    expect(isValidActionName('invoice')).toBe(false);
    expect(isValidActionName('createInvoice')).toBe(false);
    expect(isValidActionName('create-invoice')).toBe(false);
    expect(isValidActionName('Invoice.Create')).toBe(false);
    expect(isValidActionName('.invoice.create')).toBe(false);
    expect(isValidActionName('')).toBe(false);
  });
});

describe('isValidFieldName', () => {
  it('accepts valid field names', () => {
    expect(isValidFieldName('customer_email')).toBe(true);
    expect(isValidFieldName('amount')).toBe(true);
    expect(isValidFieldName('billing_address')).toBe(true);
    expect(isValidFieldName('start_date')).toBe(true);
  });

  it('rejects invalid field names', () => {
    expect(isValidFieldName('customerEmail')).toBe(false);
    expect(isValidFieldName('customer-email')).toBe(false);
    expect(isValidFieldName('Customer_Email')).toBe(false);
    expect(isValidFieldName('_private')).toBe(false);
    expect(isValidFieldName('')).toBe(false);
  });
});
