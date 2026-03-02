import type { LintResult } from './types.js';

interface ManifestActions {
  actions: Record<string, {
    inputSchema?: {
      properties?: Record<string, unknown>;
    };
  }>;
  data?: Record<string, unknown>;
  pages?: Record<string, {
    title: string;
    actions?: string[];
    data?: string[];
  }>;
}

const ACTION_RE = /data-agent-action="([^"]*)"/g;
const FIELD_RE = /data-agent-field="([^"]*)"/g;
const LINK_PAGE_RE = /data-agent-page="([^"]*)"/g;
const LINK_A_HREF_RE = /<a\b[^>]*data-agent-kind="link"[^>]*href="([^"]*)"[^>]*>/g;
const LINK_A_HREF_ALT_RE = /<a\b[^>]*href="([^"]*)"[^>]*data-agent-kind="link"[^>]*>/g;

export function checkAlignment(html: string, manifest: ManifestActions): LintResult[] {
  const results: LintResult[] = [];

  // Extract actions and fields from HTML
  const htmlActions = new Set<string>();
  const htmlFields = new Set<string>();

  let match: RegExpExecArray | null;

  ACTION_RE.lastIndex = 0;
  while ((match = ACTION_RE.exec(html)) !== null) {
    htmlActions.add(match[1]);
  }

  FIELD_RE.lastIndex = 0;
  while ((match = FIELD_RE.exec(html)) !== null) {
    htmlFields.add(match[1]);
  }

  // Check: every manifest action should have a corresponding DOM element
  for (const actionId of Object.keys(manifest.actions)) {
    // Look for action or sub-action (e.g., invoice.create or invoice.create.submit)
    const found = [...htmlActions].some(
      (a) => a === actionId || a.startsWith(actionId + '.')
    );
    if (!found) {
      results.push({
        severity: 'warning',
        message: `Manifest action "${actionId}" has no corresponding data-agent-action in HTML`,
      });
    }
  }

  // Check: manifest field names should match HTML field names
  for (const [actionId, action] of Object.entries(manifest.actions)) {
    const fieldNames = Object.keys(action.inputSchema?.properties || {});
    for (const field of fieldNames) {
      if (!htmlFields.has(field)) {
        results.push({
          severity: 'warning',
          message: `Manifest action "${actionId}" has field "${field}" not found in HTML data-agent-field attributes`,
        });
      }
    }
  }

  // Check: actions listed in pages must exist in the actions map
  if (manifest.pages) {
    for (const [route, page] of Object.entries(manifest.pages)) {
      for (const actionId of page.actions ?? []) {
        if (!manifest.actions[actionId]) {
          results.push({
            severity: 'warning',
            message: `Page "${route}" references action "${actionId}" which is not defined in manifest actions`,
          });
        }
      }
      for (const dataId of page.data ?? []) {
        if (!manifest.data || !(dataId in (manifest.data as Record<string, unknown>))) {
          results.push({
            severity: 'warning',
            message: `Page "${route}" references data view "${dataId}" which is not defined in manifest data`,
          });
        }
      }
    }
  }

  // Check: internal link targets should match manifest page routes
  if (manifest.pages) {
    const linkTargets = new Set<string>();

    LINK_PAGE_RE.lastIndex = 0;
    while ((match = LINK_PAGE_RE.exec(html)) !== null) {
      linkTargets.add(match[1]);
    }
    LINK_A_HREF_RE.lastIndex = 0;
    while ((match = LINK_A_HREF_RE.exec(html)) !== null) {
      linkTargets.add(match[1]);
    }
    LINK_A_HREF_ALT_RE.lastIndex = 0;
    while ((match = LINK_A_HREF_ALT_RE.exec(html)) !== null) {
      linkTargets.add(match[1]);
    }

    const normalize = (p: string) => (p.endsWith('/') ? p : p + '/');
    const manifestRoutes = new Set(Object.keys(manifest.pages).map(normalize));

    for (const target of linkTargets) {
      // Only validate internal targets (starting with /)
      if (!target.startsWith('/')) continue;
      if (!manifestRoutes.has(normalize(target))) {
        results.push({
          severity: 'warning',
          message: `Link target "${target}" does not match any manifest page route`,
        });
      }
    }
  }

  return results;
}

/**
 * Check alignment between rendered page HTML and a single page entry in the manifest.
 * Verifies that every action and field listed for the page actually exists in the DOM.
 */
export function checkPageAlignment(
  html: string,
  manifest: ManifestActions,
  pageRoute: string,
): LintResult[] {
  const results: LintResult[] = [];
  const page = manifest.pages?.[pageRoute];
  if (!page) return results;

  // Extract actions and fields from rendered HTML
  const htmlActions = new Set<string>();
  const htmlFields = new Set<string>();

  let match: RegExpExecArray | null;

  const actionRe = new RegExp(ACTION_RE.source, ACTION_RE.flags);
  while ((match = actionRe.exec(html)) !== null) {
    htmlActions.add(match[1]);
  }

  const fieldRe = new RegExp(FIELD_RE.source, FIELD_RE.flags);
  while ((match = fieldRe.exec(html)) !== null) {
    htmlFields.add(match[1]);
  }

  // Check each action listed on this page
  for (const actionId of page.actions ?? []) {
    // Look for action or sub-action (e.g., project.create or project.create.submit)
    const found = [...htmlActions].some(
      (a) => a === actionId || a.startsWith(actionId + '.'),
    );
    if (!found) {
      results.push({
        severity: 'warning',
        message: `Page "${pageRoute}": action "${actionId}" listed in manifest but not found in rendered DOM`,
      });
    }

    // Check fields for this action
    const action = manifest.actions[actionId];
    if (action) {
      const fieldNames = Object.keys(action.inputSchema?.properties || {});
      for (const field of fieldNames) {
        if (!htmlFields.has(field)) {
          results.push({
            severity: 'warning',
            message: `Page "${pageRoute}": field "${field}" of action "${actionId}" not found in rendered DOM`,
          });
        }
      }
    }
  }

  return results;
}
