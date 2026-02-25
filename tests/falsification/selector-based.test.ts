import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Baseline: Hard-coded CSS selectors that work on the ORIGINAL billing app
 * but BREAK on the refactored version. This demonstrates the brittleness
 * of selector-based automation.
 */

// Hard-coded selectors targeting original billing app structure
const ORIGINAL_SELECTORS = {
  invoiceForm: '#invoice-form',
  emailInput: '#customer_email',
  amountInput: '#amount',
  currencySelect: '#currency',
  memoTextarea: '#memo',
  submitButton: '.btn-primary[type="submit"]',
  statusDiv: '#status',
};

const ORIGINAL_SETTINGS_SELECTORS = {
  deleteInput: '#delete_confirmation',
  deleteButton: '#delete-btn',
  statusDiv: '#delete-status',
};

function loadHTML(relativePath: string): JSDOM {
  const fullPath = resolve(__dirname, relativePath);
  const html = readFileSync(fullPath, 'utf-8');
  return new JSDOM(html);
}

describe('Selector-based approach: ORIGINAL billing app', () => {
  it('finds invoice form by #invoice-form', () => {
    const dom = loadHTML('../../samples/billing-app/invoices/new/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SELECTORS.invoiceForm);
    expect(el).not.toBeNull();
  });

  it('finds email input by #customer_email', () => {
    const dom = loadHTML('../../samples/billing-app/invoices/new/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SELECTORS.emailInput);
    expect(el).not.toBeNull();
  });

  it('finds submit button by .btn-primary', () => {
    const dom = loadHTML('../../samples/billing-app/invoices/new/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SELECTORS.submitButton);
    expect(el).not.toBeNull();
  });

  it('finds delete button by #delete-btn', () => {
    const dom = loadHTML('../../samples/billing-app/settings/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SETTINGS_SELECTORS.deleteButton);
    expect(el).not.toBeNull();
  });
});

describe('Selector-based approach: REFACTORED billing app (EXPECTED FAILURES)', () => {
  it('FAILS to find invoice form by #invoice-form (ID removed)', () => {
    const dom = loadHTML('./refactored-billing/invoices/new/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SELECTORS.invoiceForm);
    expect(el).toBeNull(); // Selector breaks!
  });

  it('FAILS to find email input by #customer_email (ID removed)', () => {
    const dom = loadHTML('./refactored-billing/invoices/new/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SELECTORS.emailInput);
    expect(el).toBeNull(); // Selector breaks!
  });

  it('FAILS to find submit button by .btn-primary (class renamed)', () => {
    const dom = loadHTML('./refactored-billing/invoices/new/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SELECTORS.submitButton);
    expect(el).toBeNull(); // Selector breaks!
  });

  it('FAILS to find delete button by #delete-btn (ID removed)', () => {
    const dom = loadHTML('./refactored-billing/settings/index.html');
    const el = dom.window.document.querySelector(ORIGINAL_SETTINGS_SELECTORS.deleteButton);
    expect(el).toBeNull(); // Selector breaks!
  });
});
