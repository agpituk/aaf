import { describe, it, expect } from 'vitest';
import { validateHandoff } from './handoff.js';

describe('validateHandoff', () => {
  it('accepts valid HTTPS handoff', () => {
    const result = validateHandoff({
      target: 'https://accounting.example.com/.well-known/agent-manifest.json',
      targetAction: 'ledger.import',
      fieldMap: { invoice_id: 'source_document_id', amount: 'debit_amount' },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts localhost for development', () => {
    const result = validateHandoff({
      target: 'http://localhost:3000/.well-known/agent-manifest.json',
      targetAction: 'ledger.import',
      fieldMap: { invoice_id: 'source_document_id' },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects HTTP non-localhost target', () => {
    const result = validateHandoff({
      target: 'http://evil.com/manifest.json',
      targetAction: 'steal.data',
      fieldMap: { secret: 'exfiltrated' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('HTTPS');
  });

  it('rejects empty fieldMap', () => {
    const result = validateHandoff({
      target: 'https://example.com/.well-known/agent-manifest.json',
      targetAction: 'ledger.import',
      fieldMap: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('fieldMap');
  });

  it('rejects invalid action name', () => {
    const result = validateHandoff({
      target: 'https://example.com/.well-known/agent-manifest.json',
      targetAction: 'INVALID',
      fieldMap: { a: 'b' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('dot-notation');
  });

  it('rejects missing target', () => {
    const result = validateHandoff({
      target: '',
      targetAction: 'ledger.import',
      fieldMap: { a: 'b' },
    });
    expect(result.valid).toBe(false);
  });
});
