import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, buildSiteAwarePrompt } from './prompt-builder.js';
import type { ManifestActionSummary, PageSummary } from './prompt-builder.js';
import type { ActionCatalog } from '@agent-accessibility-framework/runtime-core';
import type { DataViewSummary } from '@agent-accessibility-framework/contracts';

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
    fields: [{ name: 'delete_confirmation_text' }],
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

  it('includes semantic annotations for off-page action fields', () => {
    const actionsWithSemantic: ManifestActionSummary[] = [
      {
        action: 'invoice.create',
        title: 'Create invoice',
        page: '/invoices/new',
        pageTitle: 'Create Invoice',
        risk: 'low',
        confirmation: 'review',
        fields: [
          { name: 'customer_email', semantic: 'https://schema.org/email' },
          { name: 'amount', semantic: 'https://schema.org/price' },
          { name: 'currency' },
        ],
      },
    ];
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, actionsWithSemantic, []);
    expect(prompt).toContain('customer_email [schema.org/email]');
    expect(prompt).toContain('amount [schema.org/price]');
    expect(prompt).toContain('- currency');
    expect(prompt).not.toContain('currency [');
  });

  it('includes queryable data views when provided', () => {
    const dataViews: DataViewSummary[] = [
      {
        dataView: 'invoice.list',
        title: 'List invoices',
        description: 'All invoices with status.',
        page: '/invoices/',
        pageTitle: 'Invoice List',
        fields: [
          { name: 'status', semantic: 'https://schema.org/orderStatus' },
          { name: 'min_amount', semantic: 'https://schema.org/price' },
        ],
      },
    ];
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], [], undefined, dataViews);
    expect(prompt).toContain('DATA VIEW: invoice.list');
    expect(prompt).toContain('/invoices/');
    expect(prompt).toContain('Invoice List');
    expect(prompt).toContain('status [schema.org/orderStatus]');
    expect(prompt).toContain('min_amount [schema.org/price]');
    expect(prompt).toContain('Query parameters');
  });

  it('omits data view block when no data views', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], []);
    expect(prompt).not.toContain('DATA VIEW');
    expect(prompt).not.toContain('Queryable data views');
  });

  it('includes discovered links with routes and labels', () => {
    const links = [
      { page: '/settings/profile', tagName: 'a', textContent: 'Profile' },
      { page: '/settings/privacy', tagName: 'a', textContent: 'Privacy' },
    ];
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], [], undefined, undefined, links);
    expect(prompt).toContain('Links visible on this page');
    expect(prompt).toContain('/settings/profile');
    expect(prompt).toContain('"Profile"');
    expect(prompt).toContain('/settings/privacy');
    expect(prompt).toContain('"Privacy"');
  });

  it('omits links block when no discovered links', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], []);
    expect(prompt).not.toContain('Links visible');
  });

  it('instructs LLM to use exact routes from VALID ROUTES list', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], PAGES);
    expect(prompt).toContain('VALID ROUTES');
    expect(prompt).toContain('rejected as invalid');
  });

  it('separates parameterized routes from static routes', () => {
    const pagesWithParams: PageSummary[] = [
      { route: '/dashboard', title: 'Dashboard', hasActions: false, hasData: true },
      { route: '/projects/:projectId/', title: 'Project Detail', hasActions: true, hasData: true },
    ];
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], pagesWithParams);

    expect(prompt).toContain('VALID ROUTES');
    expect(prompt).toContain('/dashboard');
    expect(prompt).toContain('PARAMETERIZED ROUTES');
    expect(prompt).toContain('/projects/:projectId/');
    expect(prompt).toContain('cannot navigate directly');
  });

  it('explains to use links for parameterized routes in rule 12', () => {
    const pagesWithParams: PageSummary[] = [
      { route: '/projects/:projectId/', title: 'Project Detail', hasActions: true, hasData: false },
    ];
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], pagesWithParams);

    expect(prompt).toContain('Routes with parameters like ":id" are templates');
    expect(prompt).toContain('find its concrete URL in the Links list');
  });

  it('puts discovered links under heading mentioning specific items', () => {
    const links = [
      { page: '/projects/abc-123', tagName: 'a', textContent: 'My Project' },
    ];
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], [], undefined, undefined, links);

    expect(prompt).toContain('Links visible on this page (use these for navigation to specific items)');
    expect(prompt).toContain('/projects/abc-123');
    expect(prompt).toContain('"My Project"');
  });
});

// --- Schema-enriched action descriptions ---

describe('describeAction with schema enrichment', () => {
  it('shows (required, string) and enum values for schema-enriched fields', () => {
    const catalog: ActionCatalog = {
      actions: [
        {
          action: 'usage_metric.change',
          kind: 'action',
          confirm: 'never',
          scope: 'usage.read',
          title: 'Set usage chart metric',
          description: 'Set which metric the usage chart displays.',
          strictFields: true,
          fields: [
            {
              field: 'metric_type',
              tagName: 'div',
              schemaType: 'string',
              required: true,
              enumValues: ['cost', 'input_tokens', 'output_tokens'],
            },
          ],
          statuses: [],
        },
      ],
      url: 'http://localhost/',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = buildSystemPrompt(catalog);

    expect(prompt).toContain('Set usage chart metric — Set which metric the usage chart displays.');
    expect(prompt).toContain('metric_type (required, string)');
    expect(prompt).toContain('values: "cost" | "input_tokens" | "output_tokens"');
    expect(prompt).toContain('Only these fields accepted.');
  });

  it('shows format annotation for email fields', () => {
    const catalog: ActionCatalog = {
      actions: [
        {
          action: 'user.invite',
          kind: 'action',
          fields: [
            {
              field: 'email',
              tagName: 'input',
              schemaType: 'string',
              required: true,
              format: 'email',
            },
          ],
          statuses: [],
        },
      ],
      url: 'http://localhost/',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = buildSystemPrompt(catalog);

    expect(prompt).toContain('email (required, string, email)');
  });

  it('falls back to tagName when no schemaType is present', () => {
    const catalog: ActionCatalog = {
      actions: [
        {
          action: 'form.fill',
          kind: 'action',
          fields: [
            { field: 'name', tagName: 'input' },
          ],
          statuses: [],
        },
      ],
      url: 'http://localhost/',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = buildSystemPrompt(catalog);

    expect(prompt).toContain('name (input)');
  });

  it('falls back to DOM options when no enumValues present', () => {
    const catalog: ActionCatalog = {
      actions: [
        {
          action: 'form.fill',
          kind: 'action',
          fields: [
            { field: 'country', tagName: 'select', options: ['US', 'UK'] },
          ],
          statuses: [],
        },
      ],
      url: 'http://localhost/',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = buildSystemPrompt(catalog);

    expect(prompt).toContain('country (select) [options: US, UK]');
  });

  it('does not show "Only these fields accepted" when strictFields is not set', () => {
    const catalog: ActionCatalog = {
      actions: [
        {
          action: 'form.fill',
          kind: 'action',
          fields: [{ field: 'name', tagName: 'input' }],
          statuses: [],
        },
      ],
      url: 'http://localhost/',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const prompt = buildSystemPrompt(catalog);

    expect(prompt).not.toContain('Only these fields accepted');
  });
});

// --- AAF context paragraph ---

describe('AAF context paragraph', () => {
  it('includes AAF context in buildSystemPrompt', () => {
    const prompt = buildSystemPrompt(CATALOG);
    expect(prompt).toContain('Agent Accessibility Framework');
    expect(prompt).toContain('enum values must match exactly');
  });

  it('includes AAF context in buildSiteAwarePrompt', () => {
    const prompt = buildSiteAwarePrompt(CURRENT_PAGE_CATALOG, [], []);
    expect(prompt).toContain('Agent Accessibility Framework');
    expect(prompt).toContain('enum values must match exactly');
  });
});
