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

  it('parses navigate response', () => {
    const result = parseResponse('{"navigate": "/settings/"}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('normalizes navigate response with relative path', () => {
    const result = parseResponse('{"navigate": "settings"}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings');
  });

  it('normalizes navigate response with full URL', () => {
    const result = parseResponse('{"navigate": "http://localhost:5173/invoices/new/"}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/invoices/new/');
  });

  it('rejects navigate response with empty path', () => {
    expect(() =>
      parseResponse('{"navigate": ""}')
    ).toThrow('must be a path');
  });

  it('parses navigate response wrapped in markdown', () => {
    const raw = '```json\n{"navigate": "/invoices/"}\n```';
    const result = parseResponse(raw);
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/invoices/');
  });

  it('converts action="navigate" with args.page to navigate response', () => {
    const result = parseResponse('{"action": "navigate", "args": {"page": "/invoices/new/"}}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/invoices/new/');
  });

  it('converts action="navigate" with args.route to navigate response', () => {
    const result = parseResponse('{"action": "navigate", "args": {"route": "/settings/"}}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('normalizes action="navigate" with relative page path', () => {
    const result = parseResponse('{"action": "navigate", "args": {"page": "invoices/new"}}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/invoices/new');
  });

  it('converts action="navigate" with full URL in args', () => {
    const result = parseResponse('{"action": "navigate", "args": {"url": "http://localhost:5173/settings/"}}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('finds page from any string arg as fallback', () => {
    const result = parseResponse('{"action": "navigate", "args": {"where": "/invoices/"}}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/invoices/');
  });

  it('rejects action="navigate" with no args', () => {
    expect(() =>
      parseResponse('{"action": "navigate", "args": {}}')
    ).toThrow('recognizable page path');
  });

  it('handles nested JSON strings in args', () => {
    const raw = '{"action": "invoice.create", "args": {"customer_email": "alice@example.com", "amount": 120, "currency": "EUR", "memo": "Payment for \\"services\\""}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.memo).toBe('Payment for "services"');
  });
});

describe('parseResponse with validRoutes', () => {
  const validRoutes = ['/invoices/', '/invoices/new', '/settings/', '/settings/appearance'];

  it('accepts a valid route', () => {
    const result = parseResponse('{"navigate": "/settings/"}', { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('normalizes trailing slash when matching', () => {
    const result = parseResponse('{"navigate": "/settings"}', { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings');
  });

  it('rejects an unknown route', () => {
    expect(() =>
      parseResponse('{"navigate": "/unknown/"}', { validRoutes })
    ).toThrow('Invalid navigation route');
  });

  it('rejects a hallucinated short path', () => {
    expect(() =>
      parseResponse('{"navigate": "/appearance"}', { validRoutes })
    ).toThrow('Invalid navigation route "/appearance"');
  });

  it('error message includes valid routes', () => {
    expect(() =>
      parseResponse('{"navigate": "/appearance"}', { validRoutes })
    ).toThrow('/settings/appearance');
  });

  it('validates action="navigate" variant', () => {
    expect(() =>
      parseResponse('{"action": "navigate", "args": {"page": "/appearance"}}', { validRoutes })
    ).toThrow('Invalid navigation route');
  });

  it('accepts action="navigate" variant with valid route', () => {
    const result = parseResponse('{"action": "navigate", "args": {"page": "/invoices/new"}}', { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/invoices/new');
  });

  it('skips validation when options not provided (backward compat)', () => {
    const result = parseResponse('{"navigate": "/any/path"}');
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/any/path');
  });

  it('skips validation when validRoutes is empty', () => {
    const result = parseResponse('{"navigate": "/any/path"}', { validRoutes: [] });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/any/path');
  });
});
