import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SemanticParser } from '@agent-native-web/runtime-core';

/**
 * AWI semantic approach: uses data-agent-* attributes via SemanticParser.
 * PASSES on BOTH original AND refactored billing apps because semantic
 * annotations are stable across CSS/layout changes.
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

describe('Semantic approach: ORIGINAL billing app', () => {
  it('discovers invoice.create with all fields', () => {
    const actions = discoverFromFile('../../samples/billing-app/invoices/new/index.html');
    const invoice = actions.find((a) => a.action === 'invoice.create');
    expect(invoice).toBeDefined();
    expect(invoice!.fields.map((f) => f.field)).toEqual(
      expect.arrayContaining(['customer_email', 'amount', 'currency', 'memo'])
    );
    expect(invoice!.submitAction).toBe('invoice.create.submit');
  });

  it('discovers workspace.delete with confirmation field', () => {
    const actions = discoverFromFile('../../samples/billing-app/settings/index.html');
    const del = actions.find((a) => a.action === 'workspace.delete');
    expect(del).toBeDefined();
    expect(del!.danger).toBe('high');
    expect(del!.confirm).toBe('required');
    expect(del!.fields.some((f) => f.field === 'delete_confirmation_text')).toBe(true);
  });
});

describe('Semantic approach: REFACTORED billing app (STILL PASSES)', () => {
  it('discovers invoice.create with all fields despite CSS/layout changes', () => {
    const actions = discoverFromFile('./refactored-billing/invoices/new/index.html');
    const invoice = actions.find((a) => a.action === 'invoice.create');
    expect(invoice).toBeDefined();
    expect(invoice!.fields.map((f) => f.field)).toEqual(
      expect.arrayContaining(['customer_email', 'amount', 'currency', 'memo'])
    );
    expect(invoice!.submitAction).toBe('invoice.create.submit');
    expect(invoice!.danger).toBe('low');
    expect(invoice!.scope).toBe('invoices.write');
  });

  it('discovers workspace.delete despite different IDs/classes/nesting', () => {
    const actions = discoverFromFile('./refactored-billing/settings/index.html');
    const del = actions.find((a) => a.action === 'workspace.delete');
    expect(del).toBeDefined();
    expect(del!.danger).toBe('high');
    expect(del!.confirm).toBe('required');
    expect(del!.fields.some((f) => f.field === 'delete_confirmation_text')).toBe(true);
  });
});
