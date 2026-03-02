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

  it('defaults missing args to empty object', () => {
    const result = parseResponse('{"action": "invoice.create"}');
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('invoice.create');
    expect(result.request.args).toEqual({});
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
    ).toThrow('could not determine target page');
  });

  it('handles nested JSON strings in args', () => {
    const raw = '{"action": "invoice.create", "args": {"customer_email": "alice@example.com", "amount": 120, "currency": "EUR", "memo": "Payment for \\"services\\""}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.memo).toBe('Payment for "services"');
  });

  it('parses stringified args object (common small LLM quirk)', () => {
    const raw = '{"action": "usage_metric.change", "args": "{\\"metric_type\\": \\"input_tokens\\"}"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
    expect(result.request.args.metric_type).toBe('input_tokens');
  });

  it('parses stringified args with whitespace (pretty-printed)', () => {
    const raw = '{"action": "usage_metric.change", "args": "{\\n  \\"metric_type\\": \\"input_tokens\\"\\n}"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.metric_type).toBe('input_tokens');
  });

  it('rejects stringified args that is not valid JSON', () => {
    expect(() =>
      parseResponse('{"action": "invoice.create", "args": "not json at all"}')
    ).toThrow('Invalid planner request');
  });
});

describe('parseResponse with validRoutes', () => {
  const validRoutes = ['/invoices/', '/invoices/new', '/settings/', '/settings/appearance', '/dashboard'];

  it('accepts root path "/" when it is a valid route', () => {
    const routesWithRoot = ['/', '/dashboard', '/settings/'];
    const result = parseResponse('{"navigate": "/"}', { validRoutes: routesWithRoot });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/');
  });

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

describe('parseResponse parameterized route resolution', () => {
  const validRoutes = [
    '/projects/',
    '/settings/',
    '/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4',
  ];

  it('resolves a parameterized route to a single matching link', () => {
    const result = parseResponse('{"navigate": "/projects/:projectId"}', { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4');
  });

  it('resolves a parameterized route with trailing slash', () => {
    const routesWithSlash = [
      '/projects/',
      '/settings/',
      '/projects/abc-123/',
    ];
    const result = parseResponse('{"navigate": "/projects/:projectId/"}', { validRoutes: routesWithSlash });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/projects/abc-123/');
  });

  it('rejects a parameterized route when multiple links match', () => {
    const routesMultiple = [
      '/projects/',
      '/projects/aaa-111',
      '/projects/bbb-222',
    ];
    expect(() =>
      parseResponse('{"navigate": "/projects/:projectId"}', { validRoutes: routesMultiple })
    ).toThrow('matches multiple links');
  });

  it('rejects a parameterized route when no links match', () => {
    const routesNoMatch = ['/settings/', '/dashboard/'];
    expect(() =>
      parseResponse('{"navigate": "/projects/:projectId"}', { validRoutes: routesNoMatch })
    ).toThrow('Invalid navigation route');
  });

  it('resolves action="navigate" variant with parameterized route', () => {
    const result = parseResponse(
      '{"action": "navigate", "args": {"page": "/projects/:projectId"}}',
      { validRoutes },
    );
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4');
  });

  it('resolves multi-segment parameterized route', () => {
    const deepRoutes = [
      '/projects/',
      '/projects/abc-123/settings/profile',
    ];
    const result = parseResponse(
      '{"navigate": "/projects/:projectId/settings/:tab"}',
      { validRoutes: deepRoutes },
    );
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/projects/abc-123/settings/profile');
  });

  it('prefers direct match over parameterized resolution', () => {
    // If somehow a route literally contains ":" and is valid, direct match wins
    const result = parseResponse('{"navigate": "/settings/"}', { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });
});

describe('parseResponse small-model normalization', () => {
  const validActions = ['session.login', 'session.logout', 'project.create', 'workspace.delete'];

  it('normalizes "parameters" key to "args"', () => {
    const raw = '{"action": "session.login", "parameters": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
    expect(result.request.args.email).toBe('a@b.com');
  });

  it('normalizes "params" key to "args"', () => {
    const raw = '{"action": "session.login", "params": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('a@b.com');
  });

  it('normalizes "arguments" key to "args"', () => {
    const raw = '{"action": "session.login", "arguments": {"email": "a@b.com"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('a@b.com');
  });

  it('does not overwrite existing "args" with alias', () => {
    const raw = '{"action": "session.login", "args": {"email": "real@b.com"}, "parameters": {"email": "wrong@b.com"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('real@b.com');
  });

  it('fuzzy-matches short action name to valid action', () => {
    const raw = '{"action": "login", "args": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
  });

  it('fuzzy-matches case-insensitive short action name', () => {
    const raw = '{"action": "Login", "args": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
  });

  it('leaves dot-notation action names untouched', () => {
    const raw = '{"action": "session.login", "args": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
  });

  it('strips unknown top-level properties', () => {
    const raw = '{"action": "session.login", "args": {"email": "a@b.com"}, "reasoning": "I chose login because..."}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
    expect((result.request as Record<string, unknown>).reasoning).toBeUndefined();
  });

  it('handles combined quirks: short action + parameters key', () => {
    const raw = '{"action": "login", "parameters": {"email": "admin@example.com", "password": "changethis"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
    expect(result.request.args.email).toBe('admin@example.com');
    expect(result.request.args.password).toBe('changethis');
  });

  it('defaults missing args to empty object', () => {
    const raw = '{"action": "session.logout"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.logout');
    expect(result.request.args).toEqual({});
  });

  it('parses stringified parameters value', () => {
    const raw = '{"action": "session.login", "parameters": "{\\"email\\": \\"a@b.com\\", \\"password\\": \\"secret\\"}"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('a@b.com');
  });

  it('does not fuzzy-match when no validActions provided', () => {
    const raw = '{"action": "login", "args": {"email": "a@b.com"}}';
    expect(() => parseResponse(raw)).toThrow('Invalid planner request');
  });

  it('fuzzy-matches "signin" to "session.login" via verb synonym', () => {
    const raw = '{"action": "signin", "args": {"email": "a@b.com"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
  });

  it('uses unknown object-valued key as args fallback ("credentials")', () => {
    const raw = '{"action": "login", "credentials": {"email": "admin@example.com", "password": "changethis"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
    expect(result.request.args.email).toBe('admin@example.com');
    expect(result.request.args.password).toBe('changethis');
  });

  it('uses unknown object-valued key as args fallback ("data")', () => {
    const raw = '{"action": "session.login", "data": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('a@b.com');
  });

  it('uses unknown stringified-object key as args fallback', () => {
    const raw = '{"action": "session.login", "input": "{\\"email\\": \\"a@b.com\\", \\"password\\": \\"secret\\"}"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('a@b.com');
  });

  it('prefers known alias over unknown object key fallback', () => {
    const raw = '{"action": "session.login", "parameters": {"email": "right@b.com"}, "data": {"email": "wrong@b.com"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('right@b.com');
  });
});

describe('parseResponse word-overlap fuzzy matching', () => {
  const validActions = [
    'session.logout',
    'usage_events.filter',
    'usage_events.export_csv',
    'usage_metric.change',
  ];

  it('matches "change_filter" to "usage_metric.change" via verb synonym', () => {
    const raw = '{"action": "change_filter", "parameters": {"filter_type": "input_tokens"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
  });

  it('matches "update_usage_metrics_filter" to "usage_metric.change" via verb synonym + word overlap', () => {
    const raw = '{"action": "update_usage_metrics_filter", "parameters": {"filter_type": "input_tokens"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
  });

  it('matches "export_usage_data" to "usage_events.export_csv" via verb synonym + word overlap', () => {
    const raw = '{"action": "export_usage_data", "args": {}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_events.export_csv');
  });

  it('does not match when score is too low (only 1 word overlap)', () => {
    const raw = '{"action": "reset_something", "args": {}}';
    expect(() => parseResponse(raw, { validActions })).toThrow('Unknown action "reset_something"');
  });

  it('does not match when tied between two valid actions', () => {
    // "usage" matches both usage_events.filter and usage_metric.change equally
    const raw = '{"action": "usage", "args": {}}';
    expect(() => parseResponse(raw, { validActions })).toThrow('Unknown action "usage"');
  });

  it('prefers suffix match over word-overlap match', () => {
    // "filter" has an exact suffix match to "usage_events.filter"
    const raw = '{"action": "filter", "args": {}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_events.filter');
  });

  it('skips fuzzy matching for already-valid action names', () => {
    const raw = '{"action": "usage_events.filter", "args": {}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_events.filter');
  });

  it('matches "modify_metric" to "usage_metric.change" via verb synonym', () => {
    const raw = '{"action": "modify_metric", "args": {}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
  });

  it('matches dot-notation "usage_filter.set_metric" via verb from last segment', () => {
    // Model invents a dot-notation name; verb "set" is in the last segment
    const raw = '{"action": "usage_filter.set_metric", "args": {"metric": "input_tokens"}}';
    const result = parseResponse(raw, { validActions });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
  });

  it('rejects unknown action with helpful error listing valid actions', () => {
    const raw = '{"action": "totally.bogus", "args": {}}';
    expect(() => parseResponse(raw, { validActions })).toThrow('Unknown action "totally.bogus"');
    expect(() => parseResponse(raw, { validActions })).toThrow('usage_metric.change');
  });
});

describe('parseResponse flat scalar args collection', () => {
  it('collects flat scalar properties into args', () => {
    const raw = '{"action": "session.login", "email": "admin@example.com", "password": "secret"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('admin@example.com');
    expect(result.request.args.password).toBe('secret');
  });

  it('prefers known aliases over flat scalar collection', () => {
    const raw = '{"action": "session.login", "parameters": {"email": "right@b.com"}, "extra": "ignored"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('right@b.com');
  });

  it('prefers object-valued fallback over flat scalar collection', () => {
    const raw = '{"action": "session.login", "credentials": {"email": "right@b.com"}, "extra": "ignored"}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.email).toBe('right@b.com');
  });

  it('collects numeric and boolean scalars', () => {
    const raw = '{"action": "invoice.create", "amount": 120, "is_draft": true}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.amount).toBe(120);
    expect(result.request.args.is_draft).toBe(true);
  });
});

describe('parseResponse field name remapping', () => {
  const validActions = ['usage_metric.change'];
  const validActionFields = { 'usage_metric.change': ['metric_type'] };

  it('remaps "filter_type" to "metric_type" via word overlap', () => {
    const raw = '{"action": "change_filter", "parameters": {"filter_type": "input_tokens"}}';
    const result = parseResponse(raw, { validActions, validActionFields });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
    expect(result.request.args.metric_type).toBe('input_tokens');
    expect(result.request.args.filter_type).toBeUndefined();
  });

  it('leaves correct field names untouched', () => {
    const raw = '{"action": "usage_metric.change", "args": {"metric_type": "cost"}}';
    const result = parseResponse(raw, { validActions, validActionFields });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.args.metric_type).toBe('cost');
  });

  it('does not remap when no word overlap exists', () => {
    const raw = '{"action": "usage_metric.change", "args": {"xyz_abc": "cost"}}';
    const result = parseResponse(raw, { validActions, validActionFields });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    // xyz_abc has no overlap with metric_type — stays as-is
    expect(result.request.args.xyz_abc).toBe('cost');
    expect(result.request.args.metric_type).toBeUndefined();
  });

  it('handles combined: fuzzy action match + flat args + field remap', () => {
    // Full real-world scenario: model invents everything
    const raw = '{"action": "update_usage_metrics_filter", "parameters": {"filter_type": "input_tokens"}}';
    const result = parseResponse(raw, {
      validActions: ['session.logout', 'usage_events.filter', 'usage_events.export_csv', 'usage_metric.change'],
      validActionFields: { 'usage_metric.change': ['metric_type'] },
    });
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('usage_metric.change');
    expect(result.request.args.metric_type).toBe('input_tokens');
  });
});

describe('parseResponse navigate-intent action names', () => {
  const validRoutes = ['/projects/', '/settings/', '/dashboard', '/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4'];
  const discoveredLinks = [
    { page: '/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4', text: 'Default Project 93.287 tokens' },
    { page: '/dashboard', text: 'Beta' },
  ];

  it('converts "navigate_to_project" with discovered link fuzzy match', () => {
    const raw = '{"action": "navigate_to_project", "request": "go to Default Project"}';
    const result = parseResponse(raw, { validRoutes, discoveredLinks });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4');
  });

  it('converts "go_to_settings" to navigate using action keyword', () => {
    const raw = '{"action": "go_to_settings", "args": {}}';
    const result = parseResponse(raw, { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('converts "open_dashboard" to navigate using action keyword', () => {
    const raw = '{"action": "open_dashboard", "args": {}}';
    const result = parseResponse(raw, { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/dashboard');
  });

  it('converts navigate-like action with path in args', () => {
    const raw = '{"action": "navigate_to", "args": {"page": "/settings/"}}';
    const result = parseResponse(raw, { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('converts navigate-like action with path in a custom property', () => {
    const raw = '{"action": "view_page", "target": "/dashboard"}';
    const result = parseResponse(raw, { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/dashboard');
  });

  it('still handles exact action="navigate" (backward compat)', () => {
    const result = parseResponse('{"action": "navigate", "args": {"page": "/settings/"}}', { validRoutes });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/settings/');
  });

  it('throws when navigate intent has no resolvable target', () => {
    expect(() =>
      parseResponse('{"action": "navigate_to_unknown", "args": {}}', { validRoutes })
    ).toThrow('could not determine target page');
  });

  it('does not treat normal action names as navigate intent', () => {
    const raw = '{"action": "session.login", "args": {"email": "a@b.com", "password": "secret"}}';
    const result = parseResponse(raw);
    expect(result.kind).toBe('action');
    if (result.kind !== 'action') throw new Error('unexpected');
    expect(result.request.action).toBe('session.login');
  });

  it('fuzzy matches "Default Project" text against discovered links', () => {
    const raw = '{"action": "show_project", "request": "show me the Default Project"}';
    const result = parseResponse(raw, { validRoutes, discoveredLinks });
    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/projects/85767d2e-3737-4c74-8d2f-6e2066a2f5f4');
  });
});
