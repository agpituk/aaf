import { describe, it, expect } from 'vitest';
import { scanHtml, scanDataViews, generateManifest, fieldToSchema, inferSemanticFromFieldName } from './html-scanner.js';

describe('scanHtml', () => {
  it('extracts action from HTML', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-scope="invoices.write">
        <input type="email" required aria-label="Customer email" data-agent-kind="field" data-agent-field="customer_email" />
        <input type="number" min="0" step="0.01" required data-agent-kind="field" data-agent-field="amount" />
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('invoice.create');
    expect(actions[0].scope).toBe('invoices.write');
    expect(actions[0].fields).toHaveLength(2);
    expect(actions[0].fields[0].field).toBe('customer_email');
    expect(actions[0].fields[0].inputType).toBe('email');
    expect(actions[0].fields[0].required).toBe(true);
    expect(actions[0].fields[0].label).toBe('Customer email');
    expect(actions[0].fields[1].field).toBe('amount');
    expect(actions[0].fields[1].inputType).toBe('number');
    expect(actions[0].fields[1].min).toBe('0');
  });

  it('extracts select options', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <select data-agent-kind="field" data-agent-field="currency" aria-label="Currency">
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions[0].fields[0].tagName).toBe('select');
    expect(actions[0].fields[0].options).toEqual(['EUR', 'USD']);
    expect(actions[0].fields[0].label).toBe('Currency');
  });

  it('detects optional fields (no required attribute)', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <textarea data-agent-kind="field" data-agent-field="memo" aria-label="Memo"></textarea>
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions[0].fields[0].required).toBeUndefined();
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

describe('scanDataViews', () => {
  it('extracts data views from collection elements', () => {
    const html = `
      <div data-agent-kind="collection" data-agent-action="invoice.list" data-agent-scope="invoices.read">
        <div data-agent-kind="item">row</div>
      </div>
    `;
    const views = scanDataViews(html);
    expect(views).toHaveLength(1);
    expect(views[0].name).toBe('invoice.list');
    expect(views[0].scope).toBe('invoices.read');
  });

  it('returns empty array for HTML without collections', () => {
    expect(scanDataViews('<div>No collections</div>')).toHaveLength(0);
  });

  it('deduplicates by name', () => {
    const html = `
      <div data-agent-kind="collection" data-agent-action="invoice.list"></div>
      <div data-agent-kind="collection" data-agent-action="invoice.list"></div>
    `;
    expect(scanDataViews(html)).toHaveLength(1);
  });
});

describe('generateManifest', () => {
  it('produces valid manifest structure with typed fields', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-scope="invoices.write" data-agent-danger="low" data-agent-confirm="optional">
        <input type="email" required aria-label="Customer email" data-agent-kind="field" data-agent-field="customer_email" />
        <input type="number" min="0" step="0.01" required data-agent-kind="field" data-agent-field="amount" />
        <select data-agent-kind="field" data-agent-field="currency" aria-label="Currency">
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
        <textarea data-agent-kind="field" data-agent-field="memo" aria-label="Memo"></textarea>
      </form>
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' });

    expect(manifest.version).toBe('0.1');
    expect(manifest.site).toEqual({ name: 'Test', origin: 'http://localhost:3000' });

    const invoiceAction = (manifest.actions as any)['invoice.create'];
    expect(invoiceAction).toBeDefined();
    expect(invoiceAction.scope).toBe('invoices.write');
    expect(invoiceAction.risk).toBe('low');
    expect(invoiceAction.confirmation).toBe('optional');

    // email → format: "email", x-semantic, required
    expect(invoiceAction.inputSchema.properties.customer_email).toEqual({
      type: 'string', format: 'email', 'x-semantic': 'https://schema.org/email', description: 'Customer email',
    });
    expect(invoiceAction.inputSchema.required).toContain('customer_email');

    // number → type: "number", minimum, multipleOf (from step), x-semantic (from field name)
    expect(invoiceAction.inputSchema.properties.amount).toEqual({
      type: 'number', minimum: 0, multipleOf: 0.01, 'x-semantic': 'https://schema.org/price',
    });
    expect(invoiceAction.inputSchema.required).toContain('amount');

    // select → enum, implicitly required (always has a value)
    expect(invoiceAction.inputSchema.properties.currency).toEqual({
      type: 'string', enum: ['EUR', 'USD'], description: 'Currency',
    });
    expect(invoiceAction.inputSchema.required).toContain('currency');

    // textarea without required → not in required[], memo infers x-semantic
    expect(invoiceAction.inputSchema.properties.memo).toEqual({
      type: 'string', description: 'Memo', 'x-semantic': 'https://schema.org/description',
    });
    expect(invoiceAction.inputSchema.required).not.toContain('memo');
  });

  it('marks all fields required on danger=high + confirm=required actions', () => {
    const actions = scanHtml(`
      <button data-agent-kind="action" data-agent-action="workspace.delete"
              data-agent-scope="workspace.delete" data-agent-danger="high" data-agent-confirm="required">
      </button>
      <input type="text" aria-label="Type DELETE to confirm"
             data-agent-kind="field" data-agent-field="delete_confirmation_text"
             data-agent-for-action="workspace.delete" />
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' });
    const deleteAction = (manifest.actions as any)['workspace.delete'];
    expect(deleteAction.inputSchema.required).toContain('delete_confirmation_text');
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
    const pageMap = { '/invoices/new': { actions: ['invoice.create'], data: [] } };
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' }, pageMap);

    expect(manifest.pages).toBeDefined();
    const pages = manifest.pages as Record<string, { title: string; actions: string[] }>;
    expect(pages['/invoices/new']).toBeDefined();
    expect(pages['/invoices/new'].actions).toContain('invoice.create');
  });

  it('includes data views when provided', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="invoice.create"></form>
    `);
    const dataViews = [{ name: 'invoice.list', scope: 'invoices.read' }];
    const pageMap = {
      '/invoices/new': { actions: ['invoice.create'], data: [] },
      '/invoices/': { actions: [], data: ['invoice.list'] },
    };
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' }, pageMap, dataViews);

    expect(manifest.data).toBeDefined();
    const data = manifest.data as Record<string, any>;
    expect(data['invoice.list']).toBeDefined();
    expect(data['invoice.list'].scope).toBe('invoices.read');

    const pages = manifest.pages as Record<string, any>;
    expect(pages['/invoices/']).toBeDefined();
    expect(pages['/invoices/'].data).toContain('invoice.list');
    expect(pages['/invoices/'].actions).toBeUndefined();
  });

  it('includes site description when provided', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="user.update"></form>
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000', description: 'A test site' });
    expect((manifest.site as any).description).toBe('A test site');
  });
});

describe('fieldToSchema', () => {
  it('maps email input to string with format and x-semantic', () => {
    expect(fieldToSchema({ field: 'email', tagName: 'input', inputType: 'email' }))
      .toEqual({ type: 'string', format: 'email', 'x-semantic': 'https://schema.org/email' });
  });

  it('maps url input to string with uri format and x-semantic', () => {
    expect(fieldToSchema({ field: 'site', tagName: 'input', inputType: 'url' }))
      .toEqual({ type: 'string', format: 'uri', 'x-semantic': 'https://schema.org/URL' });
  });

  it('maps date input to string with date format and x-semantic', () => {
    expect(fieldToSchema({ field: 'dob', tagName: 'input', inputType: 'date' }))
      .toEqual({ type: 'string', format: 'date', 'x-semantic': 'https://schema.org/Date' });
  });

  it('maps tel input to string with x-semantic', () => {
    expect(fieldToSchema({ field: 'phone', tagName: 'input', inputType: 'tel' }))
      .toEqual({ type: 'string', 'x-semantic': 'https://schema.org/telephone' });
  });

  it('maps number input with min/max', () => {
    expect(fieldToSchema({ field: 'qty', tagName: 'input', inputType: 'number', min: '1', max: '100' }))
      .toEqual({ type: 'number', minimum: 1, maximum: 100 });
  });

  it('maps checkbox to boolean', () => {
    expect(fieldToSchema({ field: 'agree', tagName: 'input', inputType: 'checkbox' }))
      .toEqual({ type: 'boolean' });
  });

  it('maps select with options to enum', () => {
    expect(fieldToSchema({ field: 'color', tagName: 'select', options: ['red', 'blue'] }))
      .toEqual({ type: 'string', enum: ['red', 'blue'] });
  });

  it('includes pattern, minLength, maxLength for string fields', () => {
    expect(fieldToSchema({ field: 'code', tagName: 'input', pattern: '[A-Z]+', minLength: '2', maxLength: '10' }))
      .toEqual({ type: 'string', pattern: '[A-Z]+', minLength: 2, maxLength: 10 });
  });

  it('includes aria-label as description', () => {
    expect(fieldToSchema({ field: 'name', tagName: 'input', label: 'Full name' }))
      .toEqual({ type: 'string', description: 'Full name', 'x-semantic': 'https://schema.org/name' });
  });

  it('defaults to string for plain input', () => {
    expect(fieldToSchema({ field: 'x', tagName: 'input' }))
      .toEqual({ type: 'string' });
  });

  it('defaults to string for textarea', () => {
    expect(fieldToSchema({ field: 'notes', tagName: 'textarea', label: 'Notes' }))
      .toEqual({ type: 'string', description: 'Notes', 'x-semantic': 'https://schema.org/description' });
  });

  it('maps step to multipleOf on number fields', () => {
    expect(fieldToSchema({ field: 'qty', tagName: 'input', inputType: 'number', step: '0.01' }))
      .toEqual({ type: 'number', multipleOf: 0.01 });
  });

  it('uses placeholder as description when no aria-label', () => {
    expect(fieldToSchema({ field: 'x', tagName: 'input', placeholder: 'Enter value' }))
      .toEqual({ type: 'string', description: 'Enter value' });
  });

  it('uses title as description when no aria-label or placeholder', () => {
    expect(fieldToSchema({ field: 'x', tagName: 'input', title: 'Help text' }))
      .toEqual({ type: 'string', description: 'Help text' });
  });

  it('prefers aria-label over placeholder and title', () => {
    expect(fieldToSchema({ field: 'x', tagName: 'input', label: 'Label', placeholder: 'Placeholder', title: 'Title' }))
      .toEqual({ type: 'string', description: 'Label' });
  });

  it('infers x-semantic from field name for email', () => {
    expect(fieldToSchema({ field: 'customer_email', tagName: 'input' }))
      .toEqual({ type: 'string', format: 'email', 'x-semantic': 'https://schema.org/email' });
  });

  it('infers x-semantic from field name for phone', () => {
    expect(fieldToSchema({ field: 'phone_number', tagName: 'input' }))
      .toEqual({ type: 'string', 'x-semantic': 'https://schema.org/telephone' });
  });

  it('infers x-semantic from field name for url/website', () => {
    expect(fieldToSchema({ field: 'website', tagName: 'input' }))
      .toEqual({ type: 'string', format: 'uri', 'x-semantic': 'https://schema.org/URL' });
  });

  it('does not override input-type semantic with field-name semantic', () => {
    // input type=email already sets x-semantic; field name "customer_email" should not change it
    expect(fieldToSchema({ field: 'customer_email', tagName: 'input', inputType: 'email' }))
      .toEqual({ type: 'string', format: 'email', 'x-semantic': 'https://schema.org/email' });
  });
});

describe('inferSemanticFromFieldName', () => {
  it('matches email pattern', () => {
    expect(inferSemanticFromFieldName('customer_email')).toEqual({ semantic: 'https://schema.org/email', format: 'email' });
  });

  it('matches phone pattern', () => {
    expect(inferSemanticFromFieldName('mobile_number')).toEqual({ semantic: 'https://schema.org/telephone' });
  });

  it('matches price/amount pattern', () => {
    expect(inferSemanticFromFieldName('total_amount')).toEqual({ semantic: 'https://schema.org/price' });
  });

  it('matches address pattern', () => {
    expect(inferSemanticFromFieldName('street_address')).toEqual({ semantic: 'https://schema.org/address' });
  });

  it('matches country pattern', () => {
    expect(inferSemanticFromFieldName('country')).toEqual({ semantic: 'https://schema.org/addressCountry' });
  });

  it('matches zip/postal pattern', () => {
    expect(inferSemanticFromFieldName('postal_code')).toEqual({ semantic: 'https://schema.org/postalCode' });
  });

  it('matches description/memo/notes pattern', () => {
    expect(inferSemanticFromFieldName('memo')).toEqual({ semantic: 'https://schema.org/description' });
  });

  it('returns undefined for unknown field names', () => {
    expect(inferSemanticFromFieldName('foobar')).toBeUndefined();
  });
});

describe('scanHtml description inference', () => {
  it('extracts action description from aria-label', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create" aria-label="Create a new invoice">
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions[0].description).toBe('Create a new invoice');
  });

  it('infers action description from nearest heading', () => {
    const html = `
      <h2>Create Invoice</h2>
      <form data-agent-kind="action" data-agent-action="invoice.create">
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions[0].description).toBe('Create Invoice');
  });

  it('extracts placeholder and title from fields', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="user.update">
        <input data-agent-kind="field" data-agent-field="name" placeholder="Enter name" title="Your full name" />
      </form>
    `;
    const actions = scanHtml(html);
    expect(actions[0].fields[0].placeholder).toBe('Enter name');
    expect(actions[0].fields[0].title).toBe('Your full name');
  });

  it('extracts data view description from aria-label', () => {
    const html = `
      <div data-agent-kind="collection" data-agent-action="invoice.list" aria-label="All invoices"></div>
    `;
    const views = scanDataViews(html);
    expect(views[0].description).toBe('All invoices');
  });

  it('infers data view description from nearest heading', () => {
    const html = `
      <h3>Invoice History</h3>
      <div data-agent-kind="collection" data-agent-action="invoice.list"></div>
    `;
    const views = scanDataViews(html);
    expect(views[0].description).toBe('Invoice History');
  });
});

describe('generateManifest descriptions', () => {
  it('includes action description when present', () => {
    const actions = scanHtml(`
      <form data-agent-kind="action" data-agent-action="invoice.create" aria-label="Create a new invoice">
      </form>
    `);
    const manifest = generateManifest(actions, { name: 'Test', origin: 'http://localhost:3000' });
    expect((manifest.actions as any)['invoice.create'].description).toBe('Create a new invoice');
  });

  it('includes data view description when present', () => {
    const dataViews = [{ name: 'invoice.list', scope: 'invoices.read', description: 'All invoices' }];
    const manifest = generateManifest([], { name: 'Test', origin: 'http://localhost:3000' }, undefined, dataViews);
    expect((manifest.data as any)['invoice.list'].description).toBe('All invoices');
  });
});
