import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';
import {
  buildSiteActions,
  buildSiteDataViews,
  buildPageSummaries,
  persistNavigation,
  checkPendingNavigation,
  NAV_STORAGE_KEY,
} from './navigation.js';

const MANIFEST: AgentManifest = {
  version: '0.1',
  site: { name: 'Test', origin: 'http://localhost:5173' },
  actions: {
    'invoice.create': {
      title: 'Create invoice',
      description: 'Creates a new invoice.',
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
      inputSchema: {
        type: 'object',
        properties: {
          delete_confirmation_text: { type: 'string' },
        },
      },
      outputSchema: { type: 'object', properties: {} },
    },
  },
  data: {
    'invoice.list': {
      title: 'List invoices',
      description: 'All invoices with customer, amount, currency, and status.',
      scope: 'invoices.read',
      outputSchema: { type: 'object', properties: {} },
    },
  },
  pages: {
    '/invoices/new': {
      title: 'Create Invoice',
      actions: ['invoice.create'],
    },
    '/invoices/': {
      title: 'Invoice List',
      data: ['invoice.list'],
    },
    '/settings/': {
      title: 'Settings',
      actions: ['workspace.delete'],
    },
  },
};

// --- buildSiteActions ---

describe('buildSiteActions', () => {
  it('returns actions NOT in currentPageActions', () => {
    const result = buildSiteActions(MANIFEST, ['invoice.create']);
    const actionNames = result.map((a) => a.action);
    expect(actionNames).toContain('workspace.delete');
    expect(actionNames).not.toContain('invoice.create');
  });

  it('skips actions not mapped to any page', () => {
    const manifest: AgentManifest = {
      ...MANIFEST,
      actions: {
        ...MANIFEST.actions,
        'orphan.action': {
          title: 'Orphan',
          scope: 'orphan',
          risk: 'none',
          confirmation: 'never',
          idempotent: true,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const result = buildSiteActions(manifest, ['invoice.create']);
    const actionNames = result.map((a) => a.action);
    expect(actionNames).not.toContain('orphan.action');
  });

  it('extracts field names from inputSchema.properties', () => {
    const result = buildSiteActions(MANIFEST, []);
    const invoiceCreate = result.find((a) => a.action === 'invoice.create');
    expect(invoiceCreate?.fields).toEqual([
      { name: 'customer_email' },
      { name: 'amount' },
      { name: 'currency' },
    ]);
  });

  it('extracts x-semantic annotations into FieldSummary', () => {
    const manifest: AgentManifest = {
      ...MANIFEST,
      actions: {
        ...MANIFEST.actions,
        'invoice.create': {
          ...MANIFEST.actions['invoice.create'],
          inputSchema: {
            type: 'object',
            properties: {
              customer_email: { type: 'string', 'x-semantic': 'https://schema.org/email' },
              amount: { type: 'number', 'x-semantic': 'https://schema.org/price' },
              currency: { type: 'string' },
            },
          },
        },
      },
    };
    const result = buildSiteActions(manifest, []);
    const invoiceCreate = result.find((a) => a.action === 'invoice.create');
    expect(invoiceCreate?.fields).toEqual([
      { name: 'customer_email', semantic: 'https://schema.org/email' },
      { name: 'amount', semantic: 'https://schema.org/price' },
      { name: 'currency' },
    ]);
  });

  it('returns [] when all actions are on current page', () => {
    const result = buildSiteActions(MANIFEST, ['invoice.create', 'workspace.delete']);
    expect(result).toEqual([]);
  });

  it('returns [] when manifest has no pages', () => {
    const manifest: AgentManifest = {
      ...MANIFEST,
      pages: undefined,
    };
    const result = buildSiteActions(manifest, []);
    expect(result).toEqual([]);
  });

  it('includes page and pageTitle for off-page actions', () => {
    const result = buildSiteActions(MANIFEST, ['invoice.create']);
    const wsDelete = result.find((a) => a.action === 'workspace.delete');
    expect(wsDelete?.page).toBe('/settings/');
    expect(wsDelete?.pageTitle).toBe('Settings');
  });

  it('includes risk and confirmation', () => {
    const result = buildSiteActions(MANIFEST, ['invoice.create']);
    const wsDelete = result.find((a) => a.action === 'workspace.delete');
    expect(wsDelete?.risk).toBe('high');
    expect(wsDelete?.confirmation).toBe('required');
  });
});

// --- buildPageSummaries ---

describe('buildPageSummaries', () => {
  it('returns pages excluding the current path', () => {
    const result = buildPageSummaries(MANIFEST, '/invoices/new');
    const routes = result.map((p) => p.route);
    expect(routes).toContain('/invoices/');
    expect(routes).toContain('/settings/');
    expect(routes).not.toContain('/invoices/new');
  });

  it('normalizes trailing slashes when matching current path', () => {
    const result = buildPageSummaries(MANIFEST, '/settings');
    const routes = result.map((p) => p.route);
    expect(routes).not.toContain('/settings/');
  });

  it('includes hasActions and hasData flags', () => {
    const result = buildPageSummaries(MANIFEST, '/invoices/new');
    const invoiceList = result.find((p) => p.route === '/invoices/');
    expect(invoiceList?.hasActions).toBe(false);
    expect(invoiceList?.hasData).toBe(true);

    const settings = result.find((p) => p.route === '/settings/');
    expect(settings?.hasActions).toBe(true);
    expect(settings?.hasData).toBe(false);
  });

  it('returns [] when manifest has no pages', () => {
    const manifest: AgentManifest = { ...MANIFEST, pages: undefined };
    expect(buildPageSummaries(manifest, '/invoices/new')).toEqual([]);
  });
});

// --- buildSiteDataViews ---

describe('buildSiteDataViews', () => {
  it('returns [] when no data views have inputSchema', () => {
    const result = buildSiteDataViews(MANIFEST);
    expect(result).toEqual([]);
  });

  it('returns queryable data views with inputSchema', () => {
    const manifest: AgentManifest = {
      ...MANIFEST,
      data: {
        'invoice.list': {
          title: 'List invoices',
          description: 'All invoices with status.',
          scope: 'invoices.read',
          inputSchema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['draft', 'sent', 'paid'], 'x-semantic': 'https://schema.org/orderStatus' },
              min_amount: { type: 'number', 'x-semantic': 'https://schema.org/price' },
            },
          },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const result = buildSiteDataViews(manifest);
    expect(result).toHaveLength(1);
    expect(result[0].dataView).toBe('invoice.list');
    expect(result[0].page).toBe('/invoices/');
    expect(result[0].pageTitle).toBe('Invoice List');
    expect(result[0].fields).toEqual([
      { name: 'status', semantic: 'https://schema.org/orderStatus' },
      { name: 'min_amount', semantic: 'https://schema.org/price' },
    ]);
  });

  it('returns [] when manifest has no pages', () => {
    const manifest: AgentManifest = { ...MANIFEST, pages: undefined };
    expect(buildSiteDataViews(manifest)).toEqual([]);
  });

  it('returns [] when manifest has no data', () => {
    const manifest: AgentManifest = { ...MANIFEST, data: undefined };
    expect(buildSiteDataViews(manifest)).toEqual([]);
  });
});

// --- persistNavigation / checkPendingNavigation ---

describe('persistNavigation / checkPendingNavigation', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  it('round-trips through sessionStorage', () => {
    const history = [{ role: 'user', text: 'delete my workspace' }];
    persistNavigation('/settings/', 'delete my workspace', history);
    const result = checkPendingNavigation();
    expect(result).not.toBeNull();
    expect(result!.userMessage).toBe('delete my workspace');
    expect(result!.targetPage).toBe('/settings/');
    expect(result!.conversationHistory).toEqual(history);
  });

  it('clears after reading (no double-processing)', () => {
    persistNavigation('/settings/', 'delete workspace', []);
    checkPendingNavigation();
    const second = checkPendingNavigation();
    expect(second).toBeNull();
  });

  it('returns null when empty', () => {
    expect(checkPendingNavigation()).toBeNull();
  });

  it('returns null for stale entries (>30s)', () => {
    const history = [{ role: 'user', text: 'hi' }];
    persistNavigation('/settings/', 'hi', history);

    // Manually overwrite with a stale timestamp
    const raw = JSON.parse(storage.get(NAV_STORAGE_KEY)!);
    raw.timestamp = Date.now() - 60_000;
    storage.set(NAV_STORAGE_KEY, JSON.stringify(raw));

    const result = checkPendingNavigation();
    expect(result).toBeNull();
  });

  it('handles malformed JSON gracefully', () => {
    storage.set(NAV_STORAGE_KEY, 'not-json');
    expect(checkPendingNavigation()).toBeNull();
  });

  it('handles missing fields gracefully', () => {
    storage.set(NAV_STORAGE_KEY, JSON.stringify({ unrelated: true }));
    expect(checkPendingNavigation()).toBeNull();
  });

  it('returns null when sessionStorage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    });
    expect(checkPendingNavigation()).toBeNull();
  });

  it('preserves navigateOnly flag', () => {
    persistNavigation('/settings/', 'go to settings', [], true);
    const result = checkPendingNavigation();
    expect(result).not.toBeNull();
    expect(result!.navigateOnly).toBe(true);
  });

  it('navigateOnly defaults to undefined for action navigation', () => {
    persistNavigation('/settings/', 'delete workspace', []);
    const result = checkPendingNavigation();
    expect(result).not.toBeNull();
    expect(result!.navigateOnly).toBeUndefined();
  });

  it('persistNavigation does not throw when sessionStorage is unavailable', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    });
    expect(() => persistNavigation('/settings/', 'test', [])).not.toThrow();
  });
});
