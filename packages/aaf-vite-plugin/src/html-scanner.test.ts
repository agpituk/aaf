import { describe, it, expect } from 'vitest';
import { scanHtml, generateManifest } from './html-scanner.js';

describe('scanHtml', () => {
  it('extracts action from HTML', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-scope="invoices.write">
        <input data-agent-kind="field" data-agent-field="customer_email" />
        <input data-agent-kind="field" data-agent-field="amount" />
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('invoice.create');
    expect(actions[0].scope).toBe('invoices.write');
    expect(actions[0].fields).toHaveLength(2);
    expect(actions[0].fields[0].field).toBe('customer_email');
    expect(actions[0].fields[1].field).toBe('amount');
  });

  it('extracts danger and confirm attributes', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="workspace.delete"
            data-agent-danger="high" data-agent-confirm="required">
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions[0].danger).toBe('high');
    expect(actions[0].confirm).toBe('required');
  });

  it('skips sub-actions', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <button data-agent-kind="action" data-agent-action="invoice.create.submit">Submit</button>
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('invoice.create');
  });

  it('links fields via forAction', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
      </form>
      <input data-agent-kind="field" data-agent-field="external_ref" data-agent-for-action="invoice.create" />
    `;
    const actions = scanHtml(html);
    expect(actions[0].fields).toHaveLength(1);
    expect(actions[0].fields[0].field).toBe('external_ref');
  });

  it('returns empty array for HTML without agent attrs', () => {
    const html = '<div><p>No agent stuff</p></div>';
    expect(scanHtml(html)).toHaveLength(0);
  });
});

describe('generateManifest', () => {
  it('produces valid manifest structure', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-scope="invoices.write" data-agent-danger="low" data-agent-confirm="optional">
        <input data-agent-kind="field" data-agent-field="customer_email" />
      </form>
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' });

    expect(manifest.version).toBe('0.2');
    expect(manifest.site).toEqual({ name: 'Test', origin: 'http://localhost:3000' });

    const invoiceAction = (manifest.actions as any)['invoice.create'];
    expect(invoiceAction).toBeDefined();
    expect(invoiceAction.scope).toBe('invoices.write');
    expect(invoiceAction.risk).toBe('low');
    expect(invoiceAction.confirmation).toBe('optional');
    expect(invoiceAction.inputSchema.properties.customer_email).toEqual({ type: 'string' });
    expect(invoiceAction.inputSchema.required).toContain('customer_email');
  });

  it('uses defaults when attributes are missing', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="user.update"></form>
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' });
    const userAction = (manifest.actions as any)['user.update'];
    expect(userAction.risk).toBe('none');
    expect(userAction.confirmation).toBe('never');
    expect(userAction.scope).toBe('user.write');
  });

  it('includes pages when pageMap is provided', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-scope="invoices.write">
        <input data-agent-kind="field" data-agent-field="customer_email" />
      </form>
    `);
    const pageMap = { '/invoices/new': ['invoice.create'] };
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' }, pageMap);

    expect(manifest.pages).toBeDefined();
    const pages = manifest.pages as Record<string, { title: string; actions: string[] }>;
    expect(pages['/invoices/new']).toBeDefined();
    expect(pages['/invoices/new'].actions).toContain('invoice.create');
  });

  it('includes site description when provided', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="user.update"></form>
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000', description: 'A test site' });
    expect((manifest.site as any).description).toBe('A test site');
  });
});
