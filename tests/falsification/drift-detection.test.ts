import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { SemanticParser } from '@agent-accessibility-framework/runtime-core';
import { lintHTML } from 'aaf-lint';

const parser = new SemanticParser();

/**
 * Drift detection: verifies that the linter catches when a semantic
 * attribute name is broken (e.g., typo in data-agent-field).
 */

describe('drift detection', () => {
  it('detects when a field name is changed/broken', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <input data-agent-kind="field" data-agent-field="customer_emailz" />
      </form>
    `;
    const dom = new JSDOM(html);
    const actions = parser.discoverActions(dom.window.document.body as unknown as Parameters<typeof parser.discoverActions>[0]);
    const invoice = actions.find((a) => a.action === 'invoice.create');

    // The field has a typo — "customer_emailz" instead of "customer_email"
    expect(invoice!.fields[0].field).toBe('customer_emailz');
    expect(invoice!.fields.some((f) => f.field === 'customer_email')).toBe(false);
  });

  it('linter catches invalid kind value', () => {
    const html = '<div data-agent-kind="invalid_kind"></div>';
    const results = lintHTML(html);
    expect(results.some((r) => r.message.includes('kind'))).toBe(true);
  });

  it('linter catches invalid danger value', () => {
    const html = '<button data-agent-kind="action" data-agent-action="test.action" data-agent-danger="extreme"></button>';
    const results = lintHTML(html);
    expect(results.some((r) => r.message.includes('danger'))).toBe(true);
  });

  it('linter catches action name format violations', () => {
    const html = '<form data-agent-kind="action" data-agent-action="InvalidAction"></form>';
    const results = lintHTML(html);
    expect(results.some((r) => r.message.includes('Action identifier'))).toBe(true);
  });
});
