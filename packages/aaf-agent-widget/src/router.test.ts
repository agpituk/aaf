import { describe, it, expect } from 'vitest';
import { matchIntentToPage, matchIntentToNavigation } from './router.js';
import type { AgentManifest, DiscoveredLink } from '@agent-accessibility-framework/runtime-core';

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

describe('matchIntentToNavigation', () => {
  const noLinks: DiscoveredLink[] = [];

  it('matches "go to settings" against manifest page title', () => {
    const result = matchIntentToNavigation('go to the settings page', manifest, noLinks, '/invoices/');
    expect(result).not.toBeNull();
    expect(result!.page).toBe('/settings/');
    expect(result!.title).toBe('Settings');
  });

  it('matches "show invoice list" against page title', () => {
    const result = matchIntentToNavigation('show the invoice list', manifest, noLinks, '/settings/');
    expect(result).not.toBeNull();
    expect(result!.page).toBe('/invoices/');
    expect(result!.title).toBe('Invoice List');
  });

  it('skips the current page', () => {
    const result = matchIntentToNavigation('go to settings', manifest, noLinks, '/settings/');
    expect(result).toBeNull();
  });

  it('skips parameterized routes', () => {
    const paramManifest: AgentManifest = {
      ...manifest,
      pages: {
        '/projects/:id': { title: 'Project Detail', actions: [] },
      },
    };
    const result = matchIntentToNavigation('go to project detail', paramManifest, noLinks, '/');
    expect(result).toBeNull();
  });

  it('matches discovered links by text content', () => {
    const links: DiscoveredLink[] = [
      { page: '/projects/', tagName: 'a', textContent: 'My Projects' },
      { page: '/billing/', tagName: 'a', textContent: 'Billing Dashboard' },
    ];
    const result = matchIntentToNavigation('go to my projects', manifest, links, '/');
    expect(result).not.toBeNull();
    expect(result!.page).toBe('/projects/');
    expect(result!.title).toBe('My Projects');
  });

  it('returns null for empty user message', () => {
    const result = matchIntentToNavigation('', manifest, noLinks, '/');
    expect(result).toBeNull();
  });

  it('returns null when no keywords match', () => {
    const result = matchIntentToNavigation('play music loudly', manifest, noLinks, '/');
    expect(result).toBeNull();
  });

  it('prefers higher-scoring match', () => {
    const links: DiscoveredLink[] = [
      { page: '/invoices/', tagName: 'a', textContent: 'All Invoices' },
    ];
    // "invoice list" matches both manifest page title ("Invoice List") and link text ("All Invoices")
    // Manifest page should win because it has more keyword overlap
    const result = matchIntentToNavigation('show the invoice list', manifest, links, '/settings/');
    expect(result).not.toBeNull();
    expect(result!.page).toBe('/invoices/');
  });
});
