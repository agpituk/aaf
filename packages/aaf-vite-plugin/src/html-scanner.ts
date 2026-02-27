export interface ScannedAction {
  action: string;
  danger?: string;
  confirm?: string;
  scope?: string;
  idempotent?: string;
  fields: ScannedField[];
}

export interface ScannedDataView {
  name: string;
  scope?: string;
}

export interface ScannedField {
  field: string;
  tagName: string;
  forAction?: string;
  inputType?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  pattern?: string;
  maxLength?: string;
  minLength?: string;
  label?: string;
  options?: string[];
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

    const inputType = extractAttr(tagStr, 'type');
    if (inputType) field.inputType = inputType;

    if (/\brequired\b/i.test(tagStr)) field.required = true;

    const min = extractAttr(tagStr, 'min');
    if (min) field.min = min;
    const max = extractAttr(tagStr, 'max');
    if (max) field.max = max;
    const step = extractAttr(tagStr, 'step');
    if (step) field.step = step;
    const pattern = extractAttr(tagStr, 'pattern');
    if (pattern) field.pattern = pattern;
    const maxLength = extractAttr(tagStr, 'maxlength');
    if (maxLength) field.maxLength = maxLength;
    const minLength = extractAttr(tagStr, 'minlength');
    if (minLength) field.minLength = minLength;
    const label = extractAttr(tagStr, 'aria-label');
    if (label) field.label = label;

    // Extract <option> values for <select> elements
    if (tagName === 'select') {
      const tagEnd = match.index! + match[0].length;
      const closeIdx = html.indexOf('</select>', tagEnd);
      if (closeIdx !== -1) {
        const selectBody = html.slice(tagEnd, closeIdx);
        const optionRegex = /<option\s[^>]*value=["']([^"']*)["'][^>]*>/gi;
        const options: string[] = [];
        let optMatch: RegExpExecArray | null;
        while ((optMatch = optionRegex.exec(selectBody)) !== null) {
          options.push(optMatch[1]);
        }
        if (options.length > 0) field.options = options;
      }
    }

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

/**
 * Scans HTML for data-agent-kind="collection" elements and returns them as data views.
 * Collections reference data views via data-agent-action (a label, not an executable action).
 */
export function scanDataViews(html: string): ScannedDataView[] {
  const views: Map<string, ScannedDataView> = new Map();
  const collectionRegex = /<(\w+)\s[^>]*data-agent-kind=["']collection["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = collectionRegex.exec(html)) !== null) {
    const tagStr = match[0];
    const name = extractAttr(tagStr, 'data-agent-action');
    if (!name) continue;

    const scope = extractAttr(tagStr, 'data-agent-scope');
    const view: ScannedDataView = { name };
    if (scope) view.scope = scope;
    views.set(name, view);
  }

  return Array.from(views.values());
}

function extractAttr(tag: string, attr: string): string | undefined {
  const regex = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const match = regex.exec(tag);
  return match?.[1];
}

/**
 * Maps a ScannedField to a JSON Schema property object.
 */
export function fieldToSchema(field: ScannedField): Record<string, unknown> {
  const schema: Record<string, unknown> = {};

  // Determine base type and infer x-semantic from input type
  if (field.tagName === 'select' && field.options && field.options.length > 0) {
    schema.type = 'string';
    schema.enum = field.options;
  } else if (field.inputType === 'number') {
    schema.type = 'number';
    if (field.min !== undefined) schema.minimum = Number(field.min);
    if (field.max !== undefined) schema.maximum = Number(field.max);
  } else if (field.inputType === 'checkbox') {
    schema.type = 'boolean';
  } else {
    schema.type = 'string';
    // Format mappings + semantic type inference
    if (field.inputType === 'email') {
      schema.format = 'email';
      schema['x-semantic'] = 'https://schema.org/email';
    } else if (field.inputType === 'url') {
      schema.format = 'uri';
      schema['x-semantic'] = 'https://schema.org/URL';
    } else if (field.inputType === 'date') {
      schema.format = 'date';
      schema['x-semantic'] = 'https://schema.org/Date';
    } else if (field.inputType === 'tel') {
      schema['x-semantic'] = 'https://schema.org/telephone';
    }
  }

  // String constraints
  if (schema.type === 'string') {
    if (field.pattern) schema.pattern = field.pattern;
    if (field.minLength !== undefined) schema.minLength = Number(field.minLength);
    if (field.maxLength !== undefined) schema.maxLength = Number(field.maxLength);
  }

  // Label → description
  if (field.label) schema.description = field.label;

  return schema;
}

/**
 * Generates an agent-manifest.json from scanned actions and data views.
 */
export function generateManifest(
  actions: ScannedAction[],
  site: { name: string; origin: string; description?: string },
  pageMap?: Record<string, { actions: string[]; data: string[] }>,
  dataViews?: ScannedDataView[],
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    version: '0.1',
    site,
    actions: {} as Record<string, unknown>,
  };

  const actionsObj = manifest.actions as Record<string, unknown>;

  for (const action of actions) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    const isDangerous = action.danger === 'high' && action.confirm === 'required';

    for (const field of action.fields) {
      properties[field.field] = fieldToSchema(field);
      if (field.required || field.tagName === 'select' || isDangerous) {
        required.push(field.field);
      }
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

  // Data views
  if (dataViews && dataViews.length > 0) {
    const dataObj: Record<string, unknown> = {};
    for (const view of dataViews) {
      dataObj[view.name] = {
        title: view.name.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        scope: view.scope || view.name.split('.')[0] + '.read',
        outputSchema: { type: 'object', properties: {} },
      };
    }
    manifest.data = dataObj;
  }

  if (pageMap && Object.keys(pageMap).length > 0) {
    const pages: Record<string, Record<string, unknown>> = {};
    for (const [route, entry] of Object.entries(pageMap)) {
      const page: Record<string, unknown> = {
        title: route === '/' ? 'Home' : route.replace(/^\/|\/$/g, '').split('/').pop()!,
      };
      if (entry.actions.length > 0) page.actions = entry.actions;
      if (entry.data.length > 0) page.data = entry.data;
      pages[route] = page;
    }
    manifest.pages = pages;
  }

  return manifest;
}
