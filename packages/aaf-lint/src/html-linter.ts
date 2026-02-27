import type { LintResult } from './types.js';

const VALID_KINDS = new Set(['action', 'field', 'status', 'result', 'collection', 'item', 'dialog', 'step', 'link']);
const VALID_DANGER = new Set(['none', 'low', 'high']);
const VALID_CONFIRM = new Set(['never', 'optional', 'review', 'required']);
const VALID_IDEMPOTENT = new Set(['true', 'false']);

// Matches data-agent-* attributes in HTML and JSX (both use attr="value" syntax)
const ATTR_PATTERN = /data-agent-(kind|action|field|output|danger|confirm|scope|idempotent|for-action|version|page)="([^"]*)"/g;
// Matches aaf-react component props: <AgentAction action="..." danger="..." ...>
const REACT_COMPONENT_PROPS: Array<{ component: RegExp; prop: string; agentAttr: string }> = [
  { component: /<AgentAction\b/i, prop: 'action', agentAttr: 'action' },
  { component: /<AgentAction\b/i, prop: 'danger', agentAttr: 'danger' },
  { component: /<AgentAction\b/i, prop: 'confirm', agentAttr: 'confirm' },
  { component: /<AgentAction\b/i, prop: 'scope', agentAttr: 'scope' },
  { component: /<AgentField\b/i, prop: 'field', agentAttr: 'field' },
  { component: /<AgentField\b/i, prop: 'forAction', agentAttr: 'for-action' },
  { component: /<AgentSubmit\b/i, prop: 'action', agentAttr: 'action' },
  { component: /<AgentStatus\b/i, prop: 'output', agentAttr: 'output' },
];

export function lintHTML(html: string, source?: string): LintResult[] {
  const results: LintResult[] = [];
  const lines = html.split('\n');
  const isJSX = source ? /\.[jt]sx?$/.test(source) : false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    let match: RegExpExecArray | null;
    ATTR_PATTERN.lastIndex = 0;

    // Extract data-agent-* from both raw HTML/JSX attributes
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

    // Validate aaf-react component props (e.g. <AgentAction action="..." danger="...">)
    if (isJSX) {
      for (const mapping of REACT_COMPONENT_PROPS) {
        if (mapping.component.test(line)) {
          const propRe = new RegExp(`\\b${mapping.prop}=["']([^"']*)["']`);
          const propMatch = propRe.exec(line);
          if (propMatch) {
            const value = propMatch[1];
            // Run the same validations as for data-agent-* attributes
            switch (mapping.agentAttr) {
              case 'danger':
                if (!VALID_DANGER.has(value)) {
                  results.push({
                    severity: 'error',
                    message: `Invalid danger prop: "${value}". Allowed: ${[...VALID_DANGER].join(', ')}`,
                    source,
                    line: lineNum,
                  });
                }
                break;
              case 'confirm':
                if (!VALID_CONFIRM.has(value)) {
                  results.push({
                    severity: 'error',
                    message: `Invalid confirm prop: "${value}". Allowed: ${[...VALID_CONFIRM].join(', ')}`,
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
            }
          }
        }
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

  // Structural check: duplicate field identifiers that resolve to the same action
  checkDuplicateFields(html, source, results);

  return results;
}

/**
 * Detect duplicate field elements that would cause ambiguous resolution
 * for the same (action, field) pair. Per spec §6.1.1, ambiguous matches
 * MUST be surfaced as warnings or errors.
 */
function checkDuplicateFields(html: string, source: string | undefined, results: LintResult[]): void {
  // Track field occurrences per action scope:
  //   key = "action::field", value = array of line numbers
  const fieldOccurrences = new Map<string, number[]>();

  // Also track global (for-action) fields to detect cross-scope duplicates
  const forActionFields = new Map<string, number[]>();

  // Find all action elements and their spans
  const actionSpans: Array<{ action: string; start: number; end: number }> = [];
  const actionTagRe = /<(\w+)\s[^>]*data-agent-kind=["']action["'][^>]*data-agent-action=["']([^"']*)["'][^>]*>/gi;
  const actionTagAlt = /<(\w+)\s[^>]*data-agent-action=["']([^"']*)["'][^>]*data-agent-kind=["']action["'][^>]*>/gi;

  for (const re of [actionTagRe, actionTagAlt]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const tag = m[1].toLowerCase();
      const action = m[2];
      const start = m.index;
      // Find the closing tag (best-effort for build-time)
      const closeTag = `</${tag}>`;
      const end = html.indexOf(closeTag, start + m[0].length);
      if (end !== -1) {
        actionSpans.push({ action, start, end: end + closeTag.length });
      }
    }
  }

  // Find all field elements
  const fieldRe = /<\w+\s[^>]*data-agent-kind=["']field["'][^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = fieldRe.exec(html)) !== null) {
    const tagStr = m[0];
    const pos = m.index;
    const lineNum = html.slice(0, pos).split('\n').length;

    const fieldName = extractFieldAttr(tagStr, 'data-agent-field');
    if (!fieldName) continue;

    const forAction = extractFieldAttr(tagStr, 'data-agent-for-action');

    if (forAction) {
      // Explicit for-action binding
      const key = `${forAction}::${fieldName}`;
      if (!forActionFields.has(key)) forActionFields.set(key, []);
      forActionFields.get(key)!.push(lineNum);
    }

    // Check which action scope this field is nested in
    for (const span of actionSpans) {
      if (pos >= span.start && pos < span.end) {
        const key = `${span.action}::${fieldName}`;
        if (!fieldOccurrences.has(key)) fieldOccurrences.set(key, []);
        fieldOccurrences.get(key)!.push(lineNum);
      }
    }
  }

  // Report duplicates: nested fields within the same action
  for (const [key, lines] of fieldOccurrences) {
    if (lines.length > 1) {
      const [action, field] = key.split('::');
      results.push({
        severity: 'warning',
        message: `Ambiguous field resolution: field "${field}" appears ${lines.length} times within action "${action}" (lines ${lines.join(', ')}). Per §6.1.1, runtimes will use the first match.`,
        source,
        line: lines[0],
      });
    }
  }

  // Report duplicates: for-action bindings
  for (const [key, lines] of forActionFields) {
    if (lines.length > 1) {
      const [action, field] = key.split('::');
      results.push({
        severity: 'warning',
        message: `Ambiguous field resolution: field "${field}" has ${lines.length} for-action bindings to "${action}" (lines ${lines.join(', ')}). Per §6.1.1, runtimes will use the first match.`,
        source,
        line: lines[0],
      });
    }
  }

  // Report conflict: field is both nested AND has a for-action binding to the same action
  for (const [key, nestedLines] of fieldOccurrences) {
    const forLines = forActionFields.get(key);
    if (forLines && forLines.length > 0) {
      const [action, field] = key.split('::');
      results.push({
        severity: 'warning',
        message: `Field "${field}" is both nested inside action "${action}" (line ${nestedLines[0]}) and bound via for-action (line ${forLines[0]}). Per §6.1.1, the nested element takes precedence.`,
        source,
        line: nestedLines[0],
      });
    }
  }
}

function extractFieldAttr(tag: string, attr: string): string | undefined {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const m = re.exec(tag);
  return m?.[1];
}
