import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, buildSiteAwarePrompt } from './prompt-builder.js';
import type { ManifestActionSummary, PageSummary } from './prompt-builder.js';
import type { ActionCatalog } from '@agent-accessibility-framework/runtime-core';

const CATALOG: ActionCatalog = {
  actions: [
    {
      action: 'invoice.create',
      kind: 'action',
      danger: 'low',
      confirm: 'optional',
      scope: 'invoices.write',
      idempotent: 'false',
      fields: [
        { field: 'customer_email', tagName: 'input' },
        { field: 'amount', tagName: 'input' },
        { field: 'currency', tagName: 'select' },
        { field: 'memo', tagName: 'textarea' },
      ],
      statuses: [{ output: 'invoice.create.status', tagName: 'div' }],
      submitAction: 'invoice.create.submit',
    },
    {
      action: 'workspace.delete',
      kind: 'action',
      danger: 'high',
      confirm: 'required',
      scope: 'workspace.delete',
      fields: [{ field: 'delete_confirmation_text', tagName: 'input' }],
      statuses: [],
    },
  ],
  url: 'http://localhost:5173/invoices/new',
  timestamp: '2024-01-01T00:00:00.000Z',
};

describe('buildSystemPrompt', () => {
  it('includes all action names', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('invoice.create');
    expect(prompt).toContain('workspace.delete');
  });

  it('includes field names', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('customer_email');
    expect(prompt).toContain('amount');
    expect(prompt).toContain('currency');
    expect(prompt).toContain('delete_confirmation_text');
  });

  it('includes risk metadata', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('risk: low');
    expect(prompt).toContain('risk: high');
  });

  it('includes confirmation metadata', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('confirmation: optional');
    expect(prompt).toContain('confirmation: required');
  });

  it('prohibits CSS selectors in rules', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('NEVER');
    expect(prompt).toContain('selector');
  });

  it('requires JSON format', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('JSON');
  });

  it('describes "none" action fallback', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('"none"');
  });

  it('includes confirmed: false instruction for destructive actions', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('confirmed');
  });
});

describe('buildUserPrompt', () => {
  it('wraps user message', () => {
    const prompt = buildUserPrompt('Create an invoice for alice@example.com');
    expect(prompt).toContain('Create an invoice for alice@example.com');
    expect(prompt).toContain('JSON');
  });
});

// --- buildSiteAwarePrompt ---

const CURRENT_PAGE_CATALOG: ActionCatalog = {
  actions: [
    {
      action: 'invoice.create',
      kind: 'action',
      danger: 'low',
      confirm: 'optional',
      scope: 'invoices.write',
      idempotent: 'false',
      fields: [
        { field: 'customer_email', tagName: 'input' },
        { field: 'amount', tagName: 'input' },
      ],
      statuses: [],
    },
  ],
  url: 'http://localhost:5173/invoices/new',
  timestamp: '2024-01-01T00:00:00.000Z',
};

const OTHER_PAGE_ACTIONS: ManifestActionSummary[] = [
  {
    action: 'workspace.delete',
    title: 'Delete workspace',
    description: 'Permanently deletes the workspace.',
    page: '/settings/',
    pageTitle: 'Settings',
    risk: 'high',
    confirmation: 'required',
    fields: ['delete_confirmation_text'],
  },
];

const PAGES: PageSummary[] = [
  { route: '/invoices/', title: 'Invoice List', description: 'All invoices', hasActions: false, hasData: true },
  { route: '/settings/', title: 'Settings', hasActions: true, hasData: false },
];

describe('buildSiteAwarePrompt', () => {
  it('includes current-page actions with full detail', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES);
    expect(prompt).toContain('invoice.create');
    expect(prompt).toContain('customer_email');
    expect(prompt).toContain('amount');
  });

  it('includes other-page actions with page location', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES);
    expect(prompt).toContain('workspace.delete');
    expect(prompt).toContain('/settings/');
    expect(prompt).toContain('"Settings"');
  });

  it('includes risk/confirmation for off-page actions', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES);
    expect(prompt).toContain('risk: high');
    expect(prompt).toContain('confirmation: required');
  });

  it('includes field names for off-page actions', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES);
    expect(prompt).toContain('delete_confirmation_text');
  });

  it('mentions navigation in rules', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES);
    expect(prompt).toContain('navigation');
  });

  it('includes pageData when provided', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES, 'Invoice #1: $100 USD');
    expect(prompt).toContain('Invoice #1: $100 USD');
  });

  it('still prohibits CSS selectors', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, OTHER_PAGE_ACTIONS, PAGES);
    expect(prompt).toContain('NEVER');
    expect(prompt).toContain('selector');
  });

  it('works with empty otherPageActions', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], []);
    expect(prompt).toContain('invoice.create');
    expect(prompt).not.toContain('other pages');
  });
});
