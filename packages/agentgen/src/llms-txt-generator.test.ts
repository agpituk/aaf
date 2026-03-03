import { describe, it, expect } from 'vitest';
import { generateLlmsTxt } from './llms-txt-generator.js';
import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';

const testManifest: AgentManifest = {
  version: '0.1',
  site: {
    name: 'Example Billing',
    origin: 'http://localhost:5173',
    description: 'A billing application for creating and managing invoices.',
  },
  actions: {
    'invoice.create': {
      title: 'Create invoice',
      description: 'Creates a new invoice for a customer.',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'review',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['customer_email', 'amount'],
        properties: {
          customer_email: { type: 'string' },
          amount: { type: 'number' },
        },
      },
      outputSchema: { type: 'object', properties: {} },
    },
    'workspace.delete': {
      title: 'Delete workspace',
      description: 'Permanently deletes the workspace.',
      scope: 'workspace.delete',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['delete_confirmation_text'],
        properties: { delete_confirmation_text: { type: 'string' } },
      },
      outputSchema: { type: 'object', properties: {} },
    },
  },
  data: {
    'invoice.list': {
      title: 'List invoices',
      description: 'All invoices with customer, amount, and status.',
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

describe('generateLlmsTxt', () => {
  it('generates header with site name and description', () => {
    const result = generateLlmsTxt(testManifest);
    expect(result).toContain('# Example Billing');
    expect(result).toContain('> A billing application');
  });

  it('lists actions with required fields and risk', () => {
    const result = generateLlmsTxt(testManifest);
    expect(result).toContain('## Actions');
    expect(result).toContain('- invoice.create:');
    expect(result).toContain('Requires: customer_email, amount.');
    expect(result).toContain('Risk: low.');
  });

  it('marks high-risk actions as HIGH', () => {
    const result = generateLlmsTxt(testManifest);
    expect(result).toContain('Risk: HIGH.');
    expect(result).toContain('Requires explicit confirmation.');
  });

  it('lists data views', () => {
    const result = generateLlmsTxt(testManifest);
    expect(result).toContain('## Data');
    expect(result).toContain('- invoice.list:');
  });

  it('lists pages with action/data references', () => {
    const result = generateLlmsTxt(testManifest);
    expect(result).toContain('## Pages');
    expect(result).toContain('/invoices/new: Create Invoice (actions: invoice.create)');
    expect(result).toContain('/invoices/: Invoice List (data: invoice.list)');
  });

  it('includes manifest location', () => {
    const result = generateLlmsTxt(testManifest);
    expect(result).toContain('## Manifest');
    expect(result).toContain('/.well-known/agent-manifest.json');
  });
});
