import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
import type { ActionCatalog } from '@agent-native-web/runtime-core';

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
