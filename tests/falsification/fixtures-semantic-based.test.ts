import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SemanticParser } from '@agent-accessibility-framework/runtime-core';

/**
 * Extended semantic tests across 10 fixture patterns.
 * PASSES on BOTH original AND refactored versions because
 * data-agent-* attributes are stable across CSS/layout changes.
 */

const parser = new SemanticParser();

function loadHTML(relativePath: string): JSDOM {
  const fullPath = resolve(__dirname, relativePath);
  const html = readFileSync(fullPath, 'utf-8');
  return new JSDOM(html);
}

function discoverFromFile(relativePath: string) {
  const dom = loadHTML(relativePath);
  return parser.discoverActions(dom.window.document.body as unknown as Parameters<typeof parser.discoverActions>[0]);
}

interface FixtureExpectation {
  action: string;
  fields: string[];
  danger?: string;
  scope?: string;
}

const EXPECTATIONS: Record<string, FixtureExpectation> = {
  'multi-step-form': { action: 'onboarding.complete', fields: ['full_name', 'email', 'company_name'], scope: 'account.write' },
  'modal-action': { action: 'member.invite', fields: ['member_email', 'role'], scope: 'members.write' },
  'date-picker': { action: 'booking.create', fields: ['guest_name', 'check_in_date', 'check_out_date'], scope: 'bookings.write' },
  'select-with-groups': { action: 'transfer.initiate', fields: ['recipient', 'category', 'amount'], scope: 'transfers.write' },
  'inline-edit': { action: 'profile.update', fields: ['display_name', 'bio', 'location'], scope: 'profile.write' },
  'file-upload': { action: 'document.upload', fields: ['doc_title', 'file', 'description'], scope: 'documents.write' },
  'multi-field-delete': { action: 'account.delete', fields: ['confirm_email', 'confirm_text', 'reason'], danger: 'high', scope: 'account.admin' },
  'pagination-list': { action: 'product.create', fields: ['product_name', 'price', 'sku'], scope: 'products.write' },
  'nested-forms': { action: 'apikey.create', fields: ['key_name', 'permissions', 'expires_in'], scope: 'settings.admin' },
  'dynamic-field': { action: 'shipping.configure', fields: ['shipping_method', 'address', 'delivery_time'], scope: 'shipping.write' },
};

const FIXTURES = Object.keys(EXPECTATIONS);

describe('Semantic approach: ORIGINAL fixtures', () => {
  for (const fixture of FIXTURES) {
    const exp = EXPECTATIONS[fixture];

    it(`discovers ${exp.action} with all fields in ${fixture}`, () => {
      const actions = discoverFromFile(`./fixtures/${fixture}/original/index.html`);
      const found = actions.find((a) => a.action === exp.action);
      expect(found).toBeDefined();
      const fieldNames = found!.fields.map((f) => f.field);
      for (const f of exp.fields) {
        expect(fieldNames).toContain(f);
      }
      if (exp.danger) expect(found!.danger).toBe(exp.danger);
      if (exp.scope) expect(found!.scope).toBe(exp.scope);
    });
  }
});

describe('Semantic approach: REFACTORED fixtures (STILL PASSES)', () => {
  for (const fixture of FIXTURES) {
    const exp = EXPECTATIONS[fixture];

    it(`discovers ${exp.action} with all fields in ${fixture} despite CSS/layout changes`, () => {
      const actions = discoverFromFile(`./fixtures/${fixture}/refactored/index.html`);
      const found = actions.find((a) => a.action === exp.action);
      expect(found).toBeDefined();
      const fieldNames = found!.fields.map((f) => f.field);
      for (const f of exp.fields) {
        expect(fieldNames).toContain(f);
      }
      if (exp.danger) expect(found!.danger).toBe(exp.danger);
      if (exp.scope) expect(found!.scope).toBe(exp.scope);
    });
  }
});
