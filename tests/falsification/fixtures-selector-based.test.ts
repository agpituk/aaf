import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Extended CSS selector tests across 10 fixture patterns.
 * Each fixture has hardcoded selectors that work on the ORIGINAL
 * but BREAK on the refactored version.
 */

function loadHTML(relativePath: string): JSDOM {
  const fullPath = resolve(__dirname, relativePath);
  const html = readFileSync(fullPath, 'utf-8');
  return new JSDOM(html);
}

// Hardcoded selectors per fixture (targeting original IDs/classes)
const FIXTURE_SELECTORS: Record<string, Record<string, string>> = {
  'multi-step-form': {
    form: '#onboarding-form',
    name: '#full_name',
    email: '#email',
    submit: '#submit-wizard',
  },
  'modal-action': {
    form: '#invite-form',
    email: '#member_email',
    role: '#role',
    submit: '#invite-btn',
  },
  'date-picker': {
    form: '#booking-form',
    guest: '#guest_name',
    checkin: '#check_in',
    submit: '#book-btn',
  },
  'select-with-groups': {
    form: '#transfer-form',
    recipient: '#recipient',
    category: '#category',
    submit: '#transfer-btn',
  },
  'inline-edit': {
    form: '#profile-form',
    name: '#display_name',
    bio: '#bio',
    submit: '#save-profile',
  },
  'file-upload': {
    form: '#upload-form',
    title: '#doc_title',
    file: '#file',
    submit: '#upload-btn',
  },
  'multi-field-delete': {
    form: '#delete-account-form',
    email: '#confirm_email',
    text: '#confirm_text',
    submit: '#delete-account-btn',
  },
  'pagination-list': {
    form: '#product-form',
    name: '#product_name',
    price: '#price',
    submit: '#add-product-btn',
  },
  'nested-forms': {
    form: '#api-key-form',
    name: '#key_name',
    permissions: '#permissions',
    submit: '#create-key-btn',
  },
  'dynamic-field': {
    form: '#shipping-form',
    method: '#shipping_method',
    address: '#address',
    submit: '#ship-btn',
  },
};

const FIXTURES = Object.keys(FIXTURE_SELECTORS);

describe('Selector-based approach: ORIGINAL fixtures (selectors work)', () => {
  for (const fixture of FIXTURES) {
    it(`finds form in ${fixture} by ID`, () => {
      const dom = loadHTML(`./fixtures/${fixture}/original/index.html`);
      const selectors = FIXTURE_SELECTORS[fixture];
      const el = dom.window.document.querySelector(selectors.form);
      expect(el).not.toBeNull();
    });

    it(`finds submit in ${fixture} by ID`, () => {
      const dom = loadHTML(`./fixtures/${fixture}/original/index.html`);
      const selectors = FIXTURE_SELECTORS[fixture];
      const el = dom.window.document.querySelector(selectors.submit);
      expect(el).not.toBeNull();
    });
  }
});

describe('Selector-based approach: REFACTORED fixtures (EXPECTED FAILURES)', () => {
  for (const fixture of FIXTURES) {
    it(`FAILS to find form in ${fixture} (ID removed)`, () => {
      const dom = loadHTML(`./fixtures/${fixture}/refactored/index.html`);
      const selectors = FIXTURE_SELECTORS[fixture];
      const el = dom.window.document.querySelector(selectors.form);
      expect(el).toBeNull(); // Selector breaks!
    });

    it(`FAILS to find submit in ${fixture} (ID removed)`, () => {
      const dom = loadHTML(`./fixtures/${fixture}/refactored/index.html`);
      const selectors = FIXTURE_SELECTORS[fixture];
      const el = dom.window.document.querySelector(selectors.submit);
      expect(el).toBeNull(); // Selector breaks!
    });
  }
});
