import type { LintResult } from './types.js';

interface ManifestActions {
  actions: Record<string, {
    inputSchema?: {
      properties?: Record<string, unknown>;
    };
    ui?: {
      page?: string;
    };
  }>;
}

const ACTION_RE = /data-agent-action="([^"]*)"/g;
const FIELD_RE = /data-agent-field="([^"]*)"/g;

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

  return results;
}
