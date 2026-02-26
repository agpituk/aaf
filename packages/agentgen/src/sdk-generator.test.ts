import { describe, it, expect } from 'vitest';
import { generateSDK, generateCLI } from './sdk-generator.js';
import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';

const billingManifest: AgentManifest = {
  version: '0.1',
  site: { name: 'Example Billing', origin: 'https://billing.example.com' },
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
};

describe('generateSDK', () => {
  const files = generateSDK(billingManifest);

  it('generates types.ts, client.ts, and index.ts', () => {
    expect(files.has('types.ts')).toBe(true);
    expect(files.has('client.ts')).toBe(true);
    expect(files.has('index.ts')).toBe(true);
  });

  it('generates input interfaces with correct fields', () => {
    const types = files.get('types.ts')!;
    expect(types).toContain('InvoiceCreateInput');
    expect(types).toContain('customer_email');
    expect(types).toContain('amount');
    expect(types).toContain('currency');
    expect(types).toContain("'EUR' | 'USD'");
    expect(types).toContain('memo?');
  });

  it('generates output interfaces', () => {
    const types = files.get('types.ts')!;
    expect(types).toContain('InvoiceCreateOutput');
    expect(types).toContain('invoice_id');
    expect(types).toContain("'draft' | 'sent'");
  });

  it('generates client with methods for each action', () => {
    const client = files.get('client.ts')!;
    expect(client).toContain('invoiceCreate');
    expect(client).toContain('workspaceDelete');
    expect(client).toContain('ExampleBillingClient');
  });

  it('includes risk metadata in JSDoc', () => {
    const client = files.get('client.ts')!;
    expect(client).toContain('@risk low');
    expect(client).toContain('@risk high');
    expect(client).toContain('@confirmation required');
  });

  it('generates valid TypeScript (no syntax errors in types)', () => {
    const types = files.get('types.ts')!;
    // Each interface should have matching braces
    const opens = (types.match(/{/g) || []).length;
    const closes = (types.match(/}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('handles the workspace.delete action types', () => {
    const types = files.get('types.ts')!;
    expect(types).toContain('WorkspaceDeleteInput');
    expect(types).toContain('delete_confirmation_text');
    expect(types).toContain('WorkspaceDeleteOutput');
    expect(types).toContain('deleted');
    expect(types).toContain('boolean');
  });
});

describe('generateCLI', () => {
  const files = generateCLI(billingManifest);

  it('generates cli.ts', () => {
    expect(files.has('cli.ts')).toBe(true);
  });

  it('includes action definitions', () => {
    const cli = files.get('cli.ts')!;
    expect(cli).toContain('invoice.create');
    expect(cli).toContain('workspace.delete');
  });

  it('includes CLI flags for fields', () => {
    const cli = files.get('cli.ts')!;
    expect(cli).toContain('--customer-email');
    expect(cli).toContain('--amount');
    expect(cli).toContain('--currency');
  });

  it('includes dry-run and ui mode support', () => {
    const cli = files.get('cli.ts')!;
    expect(cli).toContain('--dry-run');
    expect(cli).toContain('--ui');
  });

  it('includes actions list command', () => {
    const cli = files.get('cli.ts')!;
    expect(cli).toContain('actions');
    expect(cli).toContain('Available actions');
  });
});
