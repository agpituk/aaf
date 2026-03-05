import { describe, it, expect } from 'vitest';
import { matchIntentToPage } from './router.js';
import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';

const manifest: AgentManifest = {
  version: '0.1',
  site: { name: 'Test', origin: 'http://localhost' },
  actions: {
    'invoice.create': {
      title: 'Create invoice',
      description: 'Creates a new invoice for a customer with amount and currency.',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'review',
      idempotent: false,
      inputSchema: {
        type: 'object',
        properties: {
          customer_email: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
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
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
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
    '/invoices/': {
      title: 'Invoice List',
      data: ['invoice.list'],
    },
  },
};

describe('matchIntentToPage', () => {
  it('matches "create an invoice" to invoice.create when on settings page', () => {
    const result = matchIntentToPage('create an invoice', manifest, ['workspace.delete']);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('invoice.create');
    expect(result!.page).toBe('/invoices/new');
  });

  it('matches "delete workspace" to workspace.delete when on invoices page', () => {
    const result = matchIntentToPage('delete the workspace', manifest, ['invoice.create']);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('workspace.delete');
    expect(result!.page).toBe('/settings/');
  });

  it('returns null when all actions are on current page', () => {
    const result = matchIntentToPage('create invoice', manifest, ['invoice.create', 'workspace.delete']);
    expect(result).toBeNull();
  });

  it('returns null for empty/short user message', () => {
    const result = matchIntentToPage('', manifest, []);
    expect(result).toBeNull();
  });

  it('returns null when no keywords match above threshold', () => {
    const result = matchIntentToPage('play music loudly', manifest, []);
    expect(result).toBeNull();
  });

  it('scores higher for more keyword overlap', () => {
    // "invoice customer email amount" should strongly match invoice.create
    const result = matchIntentToPage(
      'create invoice for customer email with amount',
      manifest,
      ['workspace.delete'],
    );
    expect(result).not.toBeNull();
    expect(result!.action).toBe('invoice.create');
    expect(result!.score).toBeGreaterThan(2);
  });

  it('skips actions without a page mapping', () => {
    const noPageManifest: AgentManifest = {
      ...manifest,
      pages: {}, // no page mappings
    };
    const result = matchIntentToPage('create invoice', noPageManifest, []);
    expect(result).toBeNull();
  });
});
