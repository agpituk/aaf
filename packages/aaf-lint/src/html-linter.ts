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
    // Exception: SPA router components (<Link to="...">, <RouterLink to="...">, etc.)
    // render as <a> in the DOM and derive target from the `to` prop.
    // Exception: HeroUI <Link href="..."> renders as <a> in DOM.
    // For multi-line JSX tags, look back/forward to find sibling attributes.
    if (/data-agent-kind="link"/.test(line) && !/<a\b/.test(line) && !/data-agent-page[="{]/.test(line)) {
      // Check nearby lines for data-agent-page (multi-line JSX attributes)
      let hasPageAttr = false;
      const nearby = Math.min(lines.length - 1, i + 5);
      for (let j = i + 1; j <= nearby; j++) {
        if (/data-agent-page[="{]/.test(lines[j])) { hasPageAttr = true; break; }
        // Stop at tag close or new tag open
        if (/\/>|>/.test(lines[j]) || /^\s*<\w/.test(lines[j])) break;
      }
      if (hasPageAttr) continue;

      // Look back for <a>, router Link, or HeroUI <Link href="..."> on preceding lines
      let isLinkElement = false;
      const lookback = Math.max(0, i - 10);
      for (let j = i; j >= lookback; j--) {
        const checkLine = lines[j];
        // Direct <a> tag
        if (/<a\b/.test(checkLine)) { isLinkElement = true; break; }
        // Router Link with to= prop (renders as <a>)
        if (/^.*<(?:Link|RouterLink|NavLink|NuxtLink)\b/.test(checkLine) && /\bto[={"\s']/.test(checkLine)) {
          isLinkElement = true;
          break;
        }
        // HeroUI/component <Link href="..."> (renders as <a>)
        if (/^.*<Link\b/.test(checkLine) && /\bhref[={"\s']/.test(checkLine)) {
          isLinkElement = true;
          break;
        }
        // Found a router/Link component — check if any line between it and current has to= or href=
        if (/^.*<(?:Link|RouterLink|NavLink|NuxtLink)\b/.test(checkLine)) {
          for (let k = j; k <= i; k++) {
            if (/\b(?:to|href)[={"\s']/.test(lines[k])) {
              isLinkElement = true;
              break;
            }
          }
          break;
        }
        // Stop looking back if we hit a self-closing or closing tag (but not on same line)
        if (j < i && /\/>/.test(checkLine)) break;
      }
      if (!isLinkElement) {
        results.push({
          severity: 'error',
          message: `data-agent-kind="link" on non-<a> element requires data-agent-page`,
          source,
          line: lineNum,
        });
      }
    }
  }

  // Structural check: duplicate field identifiers that resolve to the same action
  checkDuplicateFields(html, source, results);

  // SPA router link check: detect <Link to="...">, <RouterLink to="...">, etc. missing data-agent-kind="link"
  checkRouterLinks(html, source, results);

  // Native form control check: <select>, <input>, <textarea> without data-agent-field
  checkUnannotatedFormControls(html, source, results);

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

/**
 * Detect SPA router link components (<Link to="...">, <RouterLink to="...">, etc.)
 * that are missing data-agent-kind="link". These components render as <a> tags in the
 * DOM but the linter cannot audit them on authenticated pages (gets redirected to login).
 * Source-level detection catches them regardless of auth state.
 */
const ROUTER_LINK_COMPONENTS = ['Link', 'RouterLink', 'NavLink', 'NuxtLink'];
const ROUTER_LINK_RE = new RegExp(`<(${ROUTER_LINK_COMPONENTS.join('|')})\\b`, 'g');
// JSX expression for data-agent-kind: both "link" and {"link"}
const AGENT_LINK_KIND_RE = /data-agent-kind=(?:"link"|=?\{"link"\})/;

function checkRouterLinks(html: string, source: string | undefined, results: LintResult[]): void {
  const isJSX = source ? /\.[jt]sx?$/.test(source) : false;
  if (!isJSX) return;

  ROUTER_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ROUTER_LINK_RE.exec(html)) !== null) {
    const component = match[1];
    const startPos = match.index;
    const lineNum = html.slice(0, startPos).split('\n').length;

    // Extract the full opening tag, handling nested JSX expressions {…}
    let braceDepth = 0;
    let tagEnd = startPos + match[0].length;

    while (tagEnd < html.length) {
      const ch = html[tagEnd];
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (braceDepth === 0 && ch === '>') break;
      tagEnd++;
    }

    if (tagEnd >= html.length) continue;

    const fullTag = html.slice(startPos, tagEnd + 1);

    // Must have a `to` prop — distinguishes router Link from generic <Link href="...">
    if (!/\bto[={"\s']/.test(fullTag)) continue;

    // Already has data-agent-kind="link" on the tag itself — good
    if (AGENT_LINK_KIND_RE.test(fullTag)) continue;

    // Check if a child element within the Link has data-agent-kind="link"
    // (pattern: annotation on inner element for clean textContent)
    const closeTag = `</${component}>`;
    const closePos = html.indexOf(closeTag, tagEnd);
    if (closePos !== -1) {
      const innerContent = html.slice(tagEnd + 1, closePos);
      if (AGENT_LINK_KIND_RE.test(innerContent)) continue;
    }

    results.push({
      severity: 'warning',
      message: `<${component} to="..."> missing data-agent-kind="link". SPA router links need explicit annotation for agent navigation — the DOM-level auditor cannot detect these on authenticated pages.`,
      source,
      line: lineNum,
    });
  }
}

/**
 * Detect native HTML form controls (<select>, <input>, <textarea>) that are
 * missing data-agent-field. Skips hidden, submit, checkbox, radio, and
 * already-annotated elements. Mirrors the DOM auditor's auditFields logic
 * but works at source level so it can catch controls on authenticated pages.
 */
const NATIVE_CONTROL_RE = /<(?:select|textarea)\b[^>]*>/g;
const NATIVE_INPUT_RE = /<input\b[^>]*>/g;
const SKIP_INPUT_TYPES = /type\s*=\s*["'](?:hidden|submit|checkbox|radio|button|reset|image)["']/i;
const HAS_AGENT_FIELD = /data-agent-(?:field|kind)\s*=\s*["']/i;

function checkUnannotatedFormControls(html: string, source: string | undefined, results: LintResult[]): void {
  // Check <select> and <textarea>
  NATIVE_CONTROL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NATIVE_CONTROL_RE.exec(html)) !== null) {
    if (HAS_AGENT_FIELD.test(m[0])) continue;
    const lineNum = html.slice(0, m.index).split('\n').length;
    const tagName = m[0].match(/^<(\w+)/)?.[1] ?? 'element';
    results.push({
      severity: 'warning',
      message: `<${tagName}> missing data-agent-field. Native form controls should be annotated so agents can interact with them.`,
      source,
      line: lineNum,
    });
  }

  // Check <input> (with type filtering)
  NATIVE_INPUT_RE.lastIndex = 0;
  while ((m = NATIVE_INPUT_RE.exec(html)) !== null) {
    if (HAS_AGENT_FIELD.test(m[0])) continue;
    if (SKIP_INPUT_TYPES.test(m[0])) continue;
    const lineNum = html.slice(0, m.index).split('\n').length;
    results.push({
      severity: 'warning',
      message: `<input> missing data-agent-field. Native form controls should be annotated so agents can interact with them.`,
      source,
      line: lineNum,
    });
  }
}
