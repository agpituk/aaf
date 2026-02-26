import { describe, it, expect } from 'vitest';
import { lintHTML } from './html-linter.js';
import { lintManifest } from './manifest-linter.js';
import { checkAlignment } from './alignment-checker.js';
import schema from '../../../schemas/agent-manifest.schema.json';

describe('lintHTML', () => {
  it('returns no errors for valid HTML', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-danger="low" data-agent-confirm="optional">
        <input data-agent-kind="field" data-agent-field="customer_email" />
        <button data-agent-kind="action" data-agent-action="invoice.create.submit">Submit</button>
      </form>
    `;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('reports error for invalid data-agent-kind', () => {
    const html = `<div data-agent-kind="invalid_kind">test</div>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('invalid_kind');
  });

  it('reports error for invalid data-agent-danger', () => {
    const html = `<button data-agent-kind="action" data-agent-danger="extreme">Delete</button>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('extreme');
  });

  it('reports error for invalid data-agent-confirm', () => {
    const html = `<button data-agent-kind="action" data-agent-confirm="always">Submit</button>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('always');
  });

  it('accepts data-agent-confirm="review" as valid', () => {
    const html = `<form data-agent-kind="action" data-agent-confirm="review">Submit</form>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('reports error for invalid data-agent-idempotent', () => {
    const html = `<form data-agent-kind="action" data-agent-idempotent="yes">Submit</form>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('yes');
  });

  it('warns about invalid action identifier format', () => {
    const html = `<button data-agent-kind="action" data-agent-action="InvalidAction">Click</button>`;
    const results = lintHTML(html);
    expect(results.some((r) => r.severity === 'warning' && r.message.includes('InvalidAction'))).toBe(true);
  });

  it('warns about invalid field identifier format', () => {
    const html = `<input data-agent-kind="field" data-agent-field="CamelCase" />`;
    const results = lintHTML(html);
    expect(results.some((r) => r.severity === 'warning' && r.message.includes('CamelCase'))).toBe(true);
  });

  it('includes line numbers in results', () => {
    const html = `line1\n<div data-agent-kind="invalid">test</div>\nline3`;
    const results = lintHTML(html, 'test.html');
    expect(results[0].line).toBe(2);
    expect(results[0].source).toBe('test.html');
  });
});

describe('lintManifest', () => {
  it('returns no errors for a valid manifest', () => {
    const manifest = {
      version: '0.1',
      site: { name: 'Test', origin: 'https://test.com' },
      actions: {
        'test.action': {
          title: 'Test',
          scope: 'test.scope',
          risk: 'low',
          confirmation: 'optional',
          idempotent: false,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const results = lintManifest(manifest, schema);
    expect(results).toHaveLength(0);
  });

  it('returns no errors for a manifest with @context', () => {
    const manifest = {
      '@context': 'https://aaf.dev/context.jsonld',
      version: '0.1',
      site: { name: 'Test', origin: 'https://test.com' },
      actions: {
        'test.action': {
          title: 'Test',
          scope: 'test.scope',
          risk: 'low',
          confirmation: 'optional',
          idempotent: false,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const results = lintManifest(manifest, schema);
    expect(results).toHaveLength(0);
  });

  it('reports errors for invalid manifest', () => {
    const manifest = { version: 'bad', site: {} };
    const results = lintManifest(manifest, schema);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe('error');
  });
});

describe('checkAlignment', () => {
  it('reports no warnings when DOM matches manifest', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <input data-agent-kind="field" data-agent-field="customer_email" />
        <input data-agent-kind="field" data-agent-field="amount" />
      </form>
    `;
    const manifest = {
      actions: {
        'invoice.create': {
          inputSchema: {
            properties: { customer_email: {}, amount: {} },
          },
        },
      },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('warns when manifest action missing from DOM', () => {
    const html = `<div>No actions here</div>`;
    const manifest = {
      actions: {
        'invoice.create': {
          inputSchema: { properties: {} },
        },
      },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('invoice.create') && r.message.includes('no corresponding'))).toBe(true);
  });

  it('warns when manifest field not found in DOM', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <input data-agent-kind="field" data-agent-field="customer_email" />
      </form>
    `;
    const manifest = {
      actions: {
        'invoice.create': {
          inputSchema: {
            properties: { customer_email: {}, missing_field: {} },
          },
        },
      },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('missing_field'))).toBe(true);
  });
});
