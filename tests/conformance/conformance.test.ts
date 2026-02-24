import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { lintHTML } from '../../packages/agent-lint/src/html-linter.js';
import { lintManifest } from '../../packages/agent-lint/src/manifest-linter.js';
import { checkAlignment } from '../../packages/agent-lint/src/alignment-checker.js';
import schema from '../../schemas/agent-manifest.schema.json';

const fixtureDir = resolve(import.meta.dirname, '.');

function readFixture(name: string): string {
  return readFileSync(resolve(fixtureDir, name), 'utf-8');
}

describe('Conformance: Valid billing app HTML', () => {
  it('passes HTML linting with no errors', () => {
    const html = readFixture('valid-billing.html');
    const results = lintHTML(html, 'valid-billing.html');
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

describe('Conformance: Invalid kind values', () => {
  it('reports errors for invalid data-agent-kind values', () => {
    const html = readFixture('invalid-kind.html');
    const results = lintHTML(html, 'invalid-kind.html');
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.message.includes('widget'))).toBe(true);
    expect(errors.some((e) => e.message.includes('trigger'))).toBe(true);
  });
});

describe('Conformance: Field mismatch', () => {
  it('warns about manifest field not present in HTML', () => {
    const html = readFixture('field-mismatch.html');
    const manifest = JSON.parse(readFixture('field-mismatch-manifest.json'));
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('nonexistent_field'))).toBe(true);
  });
});

describe('Conformance: Valid billing manifest', () => {
  it('passes manifest linting', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(fixtureDir, '../../samples/billing-app/public/.well-known/agent-manifest.json'), 'utf-8')
    );
    const results = lintManifest(manifest, schema);
    expect(results).toHaveLength(0);
  });
});
