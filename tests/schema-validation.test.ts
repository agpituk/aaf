import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../schemas/agent-manifest.schema.json';

function createValidator() {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

const exampleManifest = {
  version: '0.1',
  site: {
    name: 'Example Billing',
    origin: 'https://billing.example.com',
    description: 'A billing application for creating and managing invoices.',
  },
  actions: {
    'invoice.create': {
      title: 'Create invoice',
      description: 'Creates a new invoice for a customer.',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'optional',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['customer_email', 'amount', 'currency'],
        properties: {
          customer_email: { type: 'string', format: 'email' },
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', enum: ['EUR', 'USD'] },
          memo: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['invoice_id', 'status'],
        properties: {
          invoice_id: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'sent'] },
        },
      },
    },
    'workspace.delete': {
      title: 'Delete workspace',
      scope: 'workspace.delete',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['delete_confirmation_text'],
        properties: {
          delete_confirmation_text: { type: 'string', const: 'DELETE' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['deleted'],
        properties: {
          deleted: { type: 'boolean' },
        },
      },
    },
  },
  pages: {
    '/invoices/new': {
      title: 'Create Invoice',
      actions: ['invoice.create'],
    },
    '/settings/': {
      title: 'Settings',
      actions: ['workspace.delete'],
    },
  },
  errors: {
    UNAUTHORIZED: { message: 'User is not authorized for this action' },
    VALIDATION_ERROR: { message: 'Input validation failed' },
    CONFIRMATION_REQUIRED: {
      message: 'Action requires explicit confirmation',
    },
  },
};

describe('Agent Manifest Schema Validation', () => {
  it('validates the example manifest from the spec', () => {
    const validate = createValidator();
    const valid = validate(exampleManifest);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects a manifest missing required version field', () => {
    const validate = createValidator();
    const { version, ...noVersion } = exampleManifest;
    expect(validate(noVersion)).toBe(false);
  });

  it('rejects a manifest missing required site field', () => {
    const validate = createValidator();
    const { site, ...noSite } = exampleManifest;
    expect(validate(noSite)).toBe(false);
  });

  it('rejects a manifest missing required actions field', () => {
    const validate = createValidator();
    const { actions, ...noActions } = exampleManifest;
    expect(validate(noActions)).toBe(false);
  });

  it('accepts an empty actions object (site may have only data views)', () => {
    const validate = createValidator();
    const manifest = { ...exampleManifest, actions: {} };
    expect(validate(manifest)).toBe(true);
  });

  it('rejects an invalid risk value', () => {
    const validate = createValidator();
    const manifest = {
      ...exampleManifest,
      actions: {
        'test.action': {
          ...exampleManifest.actions['invoice.create'],
          risk: 'extreme',
        },
      },
    };
    expect(validate(manifest)).toBe(false);
  });

  it('rejects an invalid confirmation value', () => {
    const validate = createValidator();
    const manifest = {
      ...exampleManifest,
      actions: {
        'test.action': {
          ...exampleManifest.actions['invoice.create'],
          confirmation: 'always',
        },
      },
    };
    expect(validate(manifest)).toBe(false);
  });

  it('rejects an invalid version format', () => {
    const validate = createValidator();
    const manifest = { ...exampleManifest, version: 'v1' };
    expect(validate(manifest)).toBe(false);
  });

  it('rejects additional unknown top-level properties', () => {
    const validate = createValidator();
    const manifest = { ...exampleManifest, unknown_field: true };
    expect(validate(manifest)).toBe(false);
  });

  it('rejects an action missing required fields', () => {
    const validate = createValidator();
    const manifest = {
      ...exampleManifest,
      actions: {
        'test.action': {
          title: 'Test',
        },
      },
    };
    expect(validate(manifest)).toBe(false);
  });

  it('accepts a manifest without optional errors field', () => {
    const validate = createValidator();
    const { errors, ...noErrors } = exampleManifest;
    expect(validate(noErrors)).toBe(true);
  });

  it('accepts a manifest with pages', () => {
    const validate = createValidator();
    expect(validate(exampleManifest)).toBe(true);
    expect(exampleManifest.pages).toBeDefined();
  });

  it('accepts a manifest without optional pages field', () => {
    const validate = createValidator();
    const { pages, ...noPages } = exampleManifest;
    expect(validate(noPages)).toBe(true);
  });

  it('accepts an action with optional description field', () => {
    const validate = createValidator();
    expect(exampleManifest.actions['invoice.create'].description).toBeDefined();
    expect(validate(exampleManifest)).toBe(true);
  });

  it('accepts a site with optional description field', () => {
    const validate = createValidator();
    expect(exampleManifest.site.description).toBeDefined();
    expect(validate(exampleManifest)).toBe(true);
  });

  it('accepts a manifest with both actions and data views', () => {
    const validate = createValidator();
    const manifest = {
      ...exampleManifest,
      data: {
        'invoice.list': {
          title: 'List invoices',
          scope: 'invoices.read',
          outputSchema: { type: 'object', properties: {} },
        },
      },
      pages: {
        '/invoices/new': { title: 'Create Invoice', actions: ['invoice.create'] },
        '/invoices/': { title: 'Invoice List', data: ['invoice.list'] },
        '/settings/': { title: 'Settings', actions: ['workspace.delete'] },
      },
    };
    expect(validate(manifest)).toBe(true);
  });

  it('accepts a page with only data (no actions)', () => {
    const validate = createValidator();
    const manifest = {
      ...exampleManifest,
      data: {
        'invoice.list': {
          title: 'List invoices',
          scope: 'invoices.read',
          outputSchema: { type: 'object', properties: {} },
        },
      },
      pages: {
        '/invoices/': { title: 'Invoice List', data: ['invoice.list'] },
      },
    };
    expect(validate(manifest)).toBe(true);
  });
});
