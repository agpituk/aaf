export interface ScannedAction {
  action: string;
  danger?: string;
  confirm?: string;
  scope?: string;
  idempotent?: string;
  fields: ScannedField[];
}

export interface ScannedField {
  field: string;
  tagName: string;
  forAction?: string;
}

/**
 * Scans an HTML string for data-agent-* attributes and extracts action/field info.
 * Works with regex — no DOM needed (runs at build time in Node).
 */
export function scanHtml(html: string): ScannedAction[] {
  const actions: Map<string, ScannedAction> = new Map();

  // Find all elements with data-agent-kind="action" and data-agent-action="..."
  // We match opening tags that contain data-agent-kind="action"
  const actionRegex = /<(\w+)\s[^>]*data-agent-kind=["']action["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = actionRegex.exec(html)) !== null) {
    const tagStr = match[0];
    const actionName = extractAttr(tagStr, 'data-agent-action');
    if (!actionName) continue;
    // Skip sub-actions (3+ dot segments like "invoice.create.submit")
    if (actionName.split('.').length > 2) continue;

    const action: ScannedAction = {
      action: actionName,
      fields: [],
    };

    const danger = extractAttr(tagStr, 'data-agent-danger');
    const confirm = extractAttr(tagStr, 'data-agent-confirm');
    const scope = extractAttr(tagStr, 'data-agent-scope');
    const idempotent = extractAttr(tagStr, 'data-agent-idempotent');

    if (danger) action.danger = danger;
    if (confirm) action.confirm = confirm;
    if (scope) action.scope = scope;
    if (idempotent) action.idempotent = idempotent;

    actions.set(actionName, action);
  }

  // Find all fields
  const fieldRegex = /<(\w+)\s[^>]*data-agent-kind=["']field["'][^>]*>/gi;
  while ((match = fieldRegex.exec(html)) !== null) {
    const tagStr = match[0];
    const tagName = match[1].toLowerCase();
    const fieldName = extractAttr(tagStr, 'data-agent-field');
    if (!fieldName) continue;

    const forAction = extractAttr(tagStr, 'data-agent-for-action');
    const field: ScannedField = { field: fieldName, tagName };
    if (forAction) field.forAction = forAction;

    // If forAction is specified, link to that action
    if (forAction && actions.has(forAction)) {
      actions.get(forAction)!.fields.push(field);
    } else {
      // Link to first action (best-effort for build-time scanning)
      // In practice, fields are nested inside their action element
      const firstAction = actions.values().next().value;
      if (firstAction) {
        firstAction.fields.push(field);
      }
    }
  }

  return Array.from(actions.values());
}

function extractAttr(tag: string, attr: string): string | undefined {
  const regex = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const match = regex.exec(tag);
  return match?.[1];
}

/**
 * Generates an agent-manifest.json from scanned actions.
 */
export function generateManifest(
  actions: ScannedAction[],
  site: { name: string; origin: string; description?: string },
  pageMap?: Record<string, string[]>,
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    version: '0.2',
    site,
    actions: {} as Record<string, unknown>,
  };

  const actionsObj = manifest.actions as Record<string, unknown>;

  for (const action of actions) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const field of action.fields) {
      properties[field.field] = { type: 'string' };
      required.push(field.field);
    }

    actionsObj[action.action] = {
      title: action.action.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
      scope: action.scope || action.action.split('.')[0] + '.write',
      risk: action.danger || 'none',
      confirmation: action.confirm || 'never',
      idempotent: action.idempotent === 'true',
      inputSchema: {
        type: 'object',
        required,
        properties,
      },
      outputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  if (pageMap && Object.keys(pageMap).length > 0) {
    const pages: Record<string, { title: string; actions: string[] }> = {};
    for (const [route, actionNames] of Object.entries(pageMap)) {
      pages[route] = {
        title: route === '/' ? 'Home' : route.replace(/^\/|\/$/g, '').split('/').pop()!,
        actions: actionNames,
      };
    }
    manifest.pages = pages;
  }

  return manifest;
}
