import { describe, it, expect } from 'vitest';
import { parseResponse } from './response-parser.js';

describe('parseResponse', () => {
  it('parses clean JSON', () => {
    const result = parseResponse('{"action": "invoice.create", "args": {"customer_email": "alice@example.com", "amount": 120, "currency": "EUR"}}');
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args.customer_email).toBe('alice@example.com');
    expect(result.request.args.amount).toBe(120);
  });

  it('parses markdown-wrapped JSON', () => {
    const raw = '```json\n{"action": "invoice.create", "args": {"customer_email": "bob@test.com", "amount": 50, "currency": "USD"}}\n```';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args.amount).toBe(50);
  });

  it('parses JSON with preamble text', () => {
    const raw = 'Here is the plan:\n{"action": "workspace.delete", "args": {"delete_confirmation_text": "DELETE"}, "confirmed": false}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('workspace.delete');
    expect(result.request.confirmed).toBe(false);
  });

  it('parses JSON with trailing text', () => {
    const raw = '{"action": "invoice.create", "args": {"customer_email": "a@b.com", "amount": 1, "currency": "EUR"}}\nI have created the plan.';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
  });

  it('parses markdown block without json language tag', () => {
    const raw = '```\n{"action": "invoice.create", "args": {"customer_email": "a@b.com", "amount": 10, "currency": "EUR"}}\n```';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
  });

  it('throws on empty response', () => {
    expect(() => parseResponse('')).toThrow('Could not extract JSON');
  });

  it('throws on non-JSON response', () => {
    expect(() => parseResponse('I cannot help with that.')).toThrow('Could not extract JSON');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseResponse('{"action": "invoice.create", args: bad}')).toThrow();
  });

  it('throws on "none" action with error message', () => {
    expect(() =>
      parseResponse('{"action": "none", "args": {}, "error": "Cannot map request to available actions"}')
    ).toThrow('Cannot map request to available actions');
  });

  it('returns answer for "none" action with answer field', () => {
    const result = parseResponse('{"action": "none", "answer": "The supported currencies are EUR and USD."}');
    expect(result.kind).toBe('answer');
    if (result.kind !== 'answer') throw new Error('unexpected');
    expect(result.text).toBe('The supported currencies are EUR and USD.');
  });

  it('rejects response containing CSS selector in args', () => {
    expect(() =>
      parseResponse('{"action": "invoice.create", "args": {"customer_email": "#email-field"}}')
    ).toThrow('selector');
  });

  it('rejects response with invalid action name format', () => {
    expect(() =>
      parseResponse('{"action": "InvalidAction", "args": {}}')
    ).toThrow();
  });

  it('rejects response missing required args field', () => {
    expect(() =>
      parseResponse('{"action": "invoice.create"}')
    ).toThrow();
  });

  it('handles nested JSON strings in args', () => {
    const raw = '{"action": "invoice.create", "args": {"customer_email": "alice@example.com", "amount": 120, "currency": "EUR", "memo": "Payment for \\"services\\""}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.memo).toBe('Payment for "services"');
  });
});
