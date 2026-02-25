import { describe, it, expect } from 'vitest';
import { coerceArgs } from './coerce-args.js';

const invoiceSchema = {
  type: 'object',
  required: ['customer_email', 'amount', 'currency'],
  properties: {
    customer_email: { type: 'string', format: 'email' },
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', enum: ['EUR', 'USD'] },
    memo: { type: 'string' },
    quantity: { type: 'integer' },
    active: { type: 'boolean' },
  },
};

describe('coerceArgs', () => {
  // --- string → number ---
  it('coerces string to number when schema type is number', () => {
    const result = coerceArgs({ amount: '150' }, invoiceSchema);
    expect(result.args.amount).toBe(150);
    expect(result.coercions).toHaveLength(1);
    expect(result.coercions[0]).toEqual({ field: 'amount', from: '150', to: 150, rule: 'string→number' });
  });

  it('coerces string float to number', () => {
    const result = coerceArgs({ amount: '99.50' }, invoiceSchema);
    expect(result.args.amount).toBe(99.5);
  });

  it('skips NaN when coercing string to number', () => {
    const result = coerceArgs({ amount: 'abc' }, invoiceSchema);
    expect(result.args.amount).toBe('abc');
    expect(result.coercions).toHaveLength(0);
  });

  it('does not coerce number that is already a number', () => {
    const result = coerceArgs({ amount: 150 }, invoiceSchema);
    expect(result.args.amount).toBe(150);
    expect(result.coercions).toHaveLength(0);
  });

  // --- string → integer ---
  it('coerces string to integer when schema type is integer', () => {
    const result = coerceArgs({ quantity: '5' }, invoiceSchema);
    expect(result.args.quantity).toBe(5);
    expect(result.coercions[0].rule).toBe('string→integer');
  });

  it('skips non-integer floats for integer type', () => {
    const result = coerceArgs({ quantity: '5.5' }, invoiceSchema);
    expect(result.args.quantity).toBe('5.5');
    expect(result.coercions).toHaveLength(0);
  });

  it('skips NaN for integer type', () => {
    const result = coerceArgs({ quantity: 'foo' }, invoiceSchema);
    expect(result.args.quantity).toBe('foo');
    expect(result.coercions).toHaveLength(0);
  });

  // --- string → boolean ---
  it('coerces "true" to boolean true', () => {
    const result = coerceArgs({ active: 'true' }, invoiceSchema);
    expect(result.args.active).toBe(true);
    expect(result.coercions[0]).toEqual({ field: 'active', from: 'true', to: true, rule: 'string→boolean' });
  });

  it('coerces "false" to boolean false', () => {
    const result = coerceArgs({ active: 'false' }, invoiceSchema);
    expect(result.args.active).toBe(false);
  });

  it('does not coerce unrecognized strings for boolean type', () => {
    const result = coerceArgs({ active: 'yes' }, invoiceSchema);
    expect(result.args.active).toBe('yes');
    expect(result.coercions).toHaveLength(0);
  });

  // --- enum case-fix ---
  it('fixes enum case mismatch', () => {
    const result = coerceArgs({ currency: 'eur' }, invoiceSchema);
    expect(result.args.currency).toBe('EUR');
    expect(result.coercions[0]).toEqual({ field: 'currency', from: 'eur', to: 'EUR', rule: 'enum-case-fix' });
  });

  it('does not coerce when enum already matches', () => {
    const result = coerceArgs({ currency: 'EUR' }, invoiceSchema);
    expect(result.args.currency).toBe('EUR');
    expect(result.coercions).toHaveLength(0);
  });

  it('does not coerce unrecognized enum value', () => {
    const result = coerceArgs({ currency: 'GBP' }, invoiceSchema);
    expect(result.args.currency).toBe('GBP');
    expect(result.coercions).toHaveLength(0);
  });

  // --- null → delete ---
  it('deletes null values from args', () => {
    const result = coerceArgs({ memo: null, amount: '100' }, invoiceSchema);
    expect(result.args).not.toHaveProperty('memo');
    expect(result.args.amount).toBe(100);
    expect(result.coercions).toContainEqual({ field: 'memo', from: null, to: undefined, rule: 'null→delete' });
  });

  // --- immutability ---
  it('does not mutate original args', () => {
    const original = { amount: '150', currency: 'eur' };
    const originalCopy = { ...original };
    coerceArgs(original, invoiceSchema);
    expect(original).toEqual(originalCopy);
  });

  // --- combined coercions ---
  it('applies multiple coercions in a single call', () => {
    const result = coerceArgs(
      { amount: '150', currency: 'usd', active: 'true', quantity: '3', memo: null },
      invoiceSchema,
    );
    expect(result.args.amount).toBe(150);
    expect(result.args.currency).toBe('USD');
    expect(result.args.active).toBe(true);
    expect(result.args.quantity).toBe(3);
    expect(result.args).not.toHaveProperty('memo');
    expect(result.coercions).toHaveLength(5);
  });

  // --- empty / edge cases ---
  it('returns empty coercions for empty args', () => {
    const result = coerceArgs({}, invoiceSchema);
    expect(result.args).toEqual({});
    expect(result.coercions).toHaveLength(0);
  });

  it('passes through args when schema has no properties', () => {
    const result = coerceArgs({ foo: 'bar' }, { type: 'object' });
    expect(result.args).toEqual({ foo: 'bar' });
    expect(result.coercions).toHaveLength(0);
  });

  it('ignores undefined values', () => {
    const result = coerceArgs({ amount: undefined }, invoiceSchema);
    expect(result.args.amount).toBeUndefined();
    expect(result.coercions).toHaveLength(0);
  });

  it('passes through fields not in schema properties', () => {
    const result = coerceArgs({ unknown_field: 'hello' }, invoiceSchema);
    expect(result.args.unknown_field).toBe('hello');
    expect(result.coercions).toHaveLength(0);
  });
});
