import { describe, it, expect } from 'vitest';
import { actionNameToToolName, toolNameToActionName, catalogToTools, buildToolSystemPrompt } from './tool-builder.js';
import type { ActionCatalog } from '@agent-accessibility-framework/runtime-core';

describe('actionNameToToolName', () => {
  it('converts dots to underscores', () => {
    expect(actionNameToToolName('invoice.create')).toBe('invoice_create');
  });

  it('handles multiple dots', () => {
    expect(actionNameToToolName('invoice.create.submit')).toBe('invoice_create_submit');
  });

  it('passes through names without dots', () => {
    expect(actionNameToToolName('delete')).toBe('delete');
  });
});

describe('toolNameToActionName', () => {
  it('converts underscores to dots', () => {
    expect(toolNameToActionName('invoice_create')).toBe('invoice.create');
  });

  it('handles multiple underscores', () => {
    expect(toolNameToActionName('invoice_create_submit')).toBe('invoice.create.submit');
  });

  it('round-trips with actionNameToToolName', () => {
    const original = 'workspace.delete';
    expect(toolNameToActionName(actionNameToToolName(original))).toBe(original);
  });
});

describe('catalogToTools', () => {
  const catalog: ActionCatalog = {
    actions: [
      {
        action: 'invoice.create',
        kind: 'action',
        title: 'Create invoice',
        description: 'Creates a new invoice for a customer.',
        fields: [
          { field: 'customer_email', tagName: 'INPUT', schemaType: 'string', format: 'email', required: true },
          { field: 'amount', tagName: 'INPUT', schemaType: 'number', required: true },
          { field: 'currency', tagName: 'SELECT', schemaType: 'string', enumValues: ['EUR', 'USD'], required: true },
          { field: 'memo', tagName: 'INPUT', schemaType: 'string' },
        ],
        statuses: [],
      },
    ],
    url: 'http://localhost:5173/invoices/new',
    timestamp: '2024-01-01T00:00:00.000Z',
  };

  it('converts catalog to tool definitions', () => {
    const tools = catalogToTools(catalog);

    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe('function');
    expect(tools[0].function.name).toBe('invoice_create');
    expect(tools[0].function.description).toContain('Create invoice');
    expect(tools[0].function.description).toContain('Creates a new invoice');
  });

  it('builds correct JSON Schema parameters', () => {
    const tools = catalogToTools(catalog);
    const params = tools[0].function.parameters;

    expect(params.type).toBe('object');

    const props = params.properties as Record<string, Record<string, unknown>>;
    expect(props.customer_email.type).toBe('string');
    expect(props.customer_email.format).toBe('email');
    expect(props.amount.type).toBe('number');
    expect(props.currency.enum).toEqual(['EUR', 'USD']);
    expect(props.memo.type).toBe('string');
  });

  it('includes required fields', () => {
    const tools = catalogToTools(catalog);
    const params = tools[0].function.parameters;

    expect(params.required).toEqual(['customer_email', 'amount', 'currency']);
  });

  it('uses DOM options as fallback when no enumValues', () => {
    const catWithOptions: ActionCatalog = {
      ...catalog,
      actions: [{
        ...catalog.actions[0],
        fields: [
          { field: 'status', tagName: 'SELECT', options: ['draft', 'sent'] },
        ],
      }],
    };

    const tools = catalogToTools(catWithOptions);
    const props = tools[0].function.parameters.properties as Record<string, Record<string, unknown>>;
    expect(props.status.enum).toEqual(['draft', 'sent']);
  });

  it('sets additionalProperties when strictFields is true', () => {
    const strictCatalog: ActionCatalog = {
      ...catalog,
      actions: [{ ...catalog.actions[0], strictFields: true }],
    };

    const tools = catalogToTools(strictCatalog);
    expect(tools[0].function.parameters.additionalProperties).toBe(false);
  });

  it('returns empty array for catalog with no actions', () => {
    const empty: ActionCatalog = { actions: [], url: '', timestamp: '' };
    expect(catalogToTools(empty)).toEqual([]);
  });

  it('uses fallback description when title and description are missing', () => {
    const minimal: ActionCatalog = {
      actions: [{
        action: 'test.action',
        kind: 'action',
        fields: [],
        statuses: [],
      }],
      url: '',
      timestamp: '',
    };

    const tools = catalogToTools(minimal);
    expect(tools[0].function.description).toBe('Execute test.action');
  });
});

describe('buildToolSystemPrompt', () => {
  it('returns a minimal system prompt', () => {
    const prompt = buildToolSystemPrompt();
    expect(prompt).toContain('web assistant');
    expect(prompt).toContain('tools');
  });

  it('includes page data when provided', () => {
    const prompt = buildToolSystemPrompt('Invoice #1: $100');
    expect(prompt).toContain('Page data:');
    expect(prompt).toContain('Invoice #1: $100');
  });
});
