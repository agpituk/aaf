import type { LintResult } from './types.js';

const VALID_KINDS = new Set(['action', 'field', 'status', 'result', 'collection', 'item', 'dialog', 'step', 'link']);
const VALID_DANGER = new Set(['none', 'low', 'high']);
const VALID_CONFIRM = new Set(['never', 'optional', 'review', 'required']);
const VALID_IDEMPOTENT = new Set(['true', 'false']);

const ATTR_PATTERN = /data-agent-(kind|action|field|output|danger|confirm|scope|idempotent|for-action|version|page)="([^"]*)"/g;

export function lintHTML(html: string, source?: string): LintResult[] {
  const results: LintResult[] = [];
  const lines = html.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    let match: RegExpExecArray | null;
    ATTR_PATTERN.lastIndex = 0;

    while ((match = ATTR_PATTERN.exec(line)) !== null) {
      const [, attr, value] = match;

      switch (attr) {
        case 'kind':
          if (!VALID_KINDS.has(value)) {
            results.push({
              severity: 'error',
              message: `Invalid data-agent-kind value: "${value}". Allowed: ${[...VALID_KINDS].join(', ')}`,
              source,
              line: lineNum,
            });
          }
          break;

        case 'danger':
          if (!VALID_DANGER.has(value)) {
            results.push({
              severity: 'error',
              message: `Invalid data-agent-danger value: "${value}". Allowed: ${[...VALID_DANGER].join(', ')}`,
              source,
              line: lineNum,
            });
          }
          break;

        case 'confirm':
          if (!VALID_CONFIRM.has(value)) {
            results.push({
              severity: 'error',
              message: `Invalid data-agent-confirm value: "${value}". Allowed: ${[...VALID_CONFIRM].join(', ')}`,
              source,
              line: lineNum,
            });
          }
          break;

        case 'idempotent':
          if (!VALID_IDEMPOTENT.has(value)) {
            results.push({
              severity: 'error',
              message: `Invalid data-agent-idempotent value: "${value}". Allowed: true, false`,
              source,
              line: lineNum,
            });
          }
          break;

        case 'action':
          if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/.test(value)) {
            results.push({
              severity: 'warning',
              message: `Action identifier "${value}" should use dot-separated lowercase segments (e.g., "invoice.create")`,
              source,
              line: lineNum,
            });
          }
          break;

        case 'field':
          if (!/^[a-z][a-z0-9_]*$/.test(value)) {
            results.push({
              severity: 'warning',
              message: `Field identifier "${value}" should use snake_case (e.g., "customer_email")`,
              source,
              line: lineNum,
            });
          }
          break;

        case 'page':
          if (!/^\//.test(value) && !/^https?:\/\//.test(value)) {
            results.push({
              severity: 'warning',
              message: `data-agent-page value "${value}" should start with "/" or "http"`,
              source,
              line: lineNum,
            });
          }
          break;
      }
    }

    // Cross-attribute check: kind="link" on non-<a> needs data-agent-page
    if (/data-agent-kind="link"/.test(line) && !/<a\b/.test(line) && !/data-agent-page="/.test(line)) {
      results.push({
        severity: 'error',
        message: `data-agent-kind="link" on non-<a> element requires data-agent-page`,
        source,
        line: lineNum,
      });
    }
  }

  return results;
}
