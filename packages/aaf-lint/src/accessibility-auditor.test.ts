import { describe, it, expect } from 'vitest';
import { auditHTML } from './accessibility-auditor.js';

const fullyAnnotatedHTML = `
<form data-agent-kind="action" data-agent-action="invoice.create" data-agent-danger="low" data-agent-confirm="optional">
  <input type="email" data-agent-kind="field" data-agent-field="customer_email" />
  <input type="number" data-agent-kind="field" data-agent-field="amount" />
  <select data-agent-kind="field" data-agent-field="currency">
    <option value="USD">USD</option>
  </select>
  <button data-agent-kind="action" data-agent-action="invoice.create.submit">Create Invoice</button>
</form>
`;

const unannotatedHTML = `
<form>
  <input type="email" name="email" />
  <input type="number" name="amount" />
  <select name="currency">
    <option value="USD">USD</option>
  </select>
  <button type="submit">Create Invoice</button>
</form>
`;

const dangerousUnannotatedHTML = `
<button>Delete Workspace</button>
<button>Remove Account</button>
<button>Destroy Data</button>
`;

const dangerousAnnotatedHTML = `
<button data-agent-action="workspace.delete" data-agent-danger="high" data-agent-confirm="required">Delete Workspace</button>
<button data-agent-action="account.remove" data-agent-danger="high" data-agent-confirm="required">Remove Account</button>
`;

describe('auditHTML', () => {
  it('gives a high score for fully annotated HTML with manifest', () => {
    const result = auditHTML(fullyAnnotatedHTML, {
      manifest: {
        version: '0.1',
        site: { name: 'Test', origin: 'https://test.com' },
        actions: { 'invoice.create': {} },
      },
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(90);
    expect(result.summary).toContain('Excellent');
  });

  it('gives low scores for unannotated forms and fields', () => {
    const result = auditHTML(unannotatedHTML);
    const formsCategory = result.categories.find((c) => c.category === 'forms');
    const fieldsCategory = result.categories.find((c) => c.category === 'fields');
    expect(formsCategory!.score).toBe(0);
    expect(fieldsCategory!.score).toBe(0);
  });

  it('ignores hidden inputs and submit buttons in field scoring', () => {
    const html = `
      <form data-agent-action="test.action">
        <input type="hidden" name="csrf" value="token" />
        <input type="submit" value="Go" />
        <input type="email" data-agent-field="email" />
      </form>
    `;
    const result = auditHTML(html);
    const fieldsCategory = result.categories.find((c) => c.category === 'fields');
    // Only the email input counts; it's annotated
    expect(fieldsCategory!.score).toBe(100);
  });

  it('fails safety for dangerous buttons without annotations', () => {
    const result = auditHTML(dangerousUnannotatedHTML, { safety: true });
    const safetyCategory = result.categories.find((c) => c.category === 'safety');
    expect(safetyCategory!.score).toBe(0);
    expect(safetyCategory!.checks.every((c) => c.status === 'fail')).toBe(true);
  });

  it('passes safety for dangerous buttons with proper annotations', () => {
    const result = auditHTML(dangerousAnnotatedHTML, { safety: true });
    const safetyCategory = result.categories.find((c) => c.category === 'safety');
    expect(safetyCategory!.score).toBe(100);
    expect(safetyCategory!.checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('excludes safety from categories by default', () => {
    const result = auditHTML(dangerousUnannotatedHTML);
    const safetyCategory = result.categories.find((c) => c.category === 'safety');
    expect(safetyCategory).toBeUndefined();
  });

  it('gives forms score 100 when no forms exist', () => {
    const html = '<div>No forms here</div>';
    const result = auditHTML(html);
    const formsCategory = result.categories.find((c) => c.category === 'forms');
    expect(formsCategory!.score).toBe(100);
  });

  it('gives manifest score 100 when valid manifest provided', () => {
    const result = auditHTML('<div></div>', {
      manifest: {
        version: '0.1',
        site: { name: 'Test', origin: 'https://test.com' },
        actions: { 'test.action': {} },
      },
    });
    const manifestCategory = result.categories.find((c) => c.category === 'manifest');
    expect(manifestCategory!.score).toBe(100);
  });

  it('gives manifest score 0 when no manifest provided', () => {
    const result = auditHTML('<div></div>');
    const manifestCategory = result.categories.find((c) => c.category === 'manifest');
    expect(manifestCategory!.score).toBe(0);
  });

  it('gives manifest score 100 for manifest with empty actions and data views', () => {
    const result = auditHTML('<div></div>', {
      manifest: {
        version: '0.1',
        site: { name: 'Test', origin: 'https://test.com' },
        actions: {},
        data: { 'invoice.list': { title: 'Invoices', scope: 'invoices.read', outputSchema: {} } },
      },
    });
    const manifestCategory = result.categories.find((c) => c.category === 'manifest');
    expect(manifestCategory!.score).toBe(100);
  });

  it('computes a weighted overall score', () => {
    // All categories at 100 should yield 100
    const result = auditHTML('<div>No forms, fields, or buttons</div>', {
      manifest: {
        version: '0.1',
        site: { name: 'Test', origin: 'https://test.com' },
        actions: { 'test.action': {} },
      },
    });
    expect(result.overallScore).toBe(100);
  });
});
