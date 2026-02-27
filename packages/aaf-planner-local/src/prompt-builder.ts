import type { ActionCatalog, DiscoveredAction, DiscoveredLink } from '@agent-accessibility-framework/runtime-core';
import type { FieldSummary, DataViewSummary } from '@agent-accessibility-framework/contracts';

/** Lightweight summary of an action on another page, derived from the manifest. */
export interface ManifestActionSummary {
  action: string;
  title: string;
  description?: string;
  page: string;       // route like "/settings/"
  pageTitle: string;   // "Settings"
  risk: string;
  confirmation: string;
  fields: FieldSummary[];  // field names + optional semantic types from inputSchema.properties
}

/** Summary of a navigable page for the site-aware prompt. */
export interface PageSummary {
  route: string;       // "/invoices/"
  title: string;       // "Invoice List"
  description?: string;
  hasActions: boolean;  // true if page has executable actions
  hasData: boolean;     // true if page has read-only data views
}

/**
 * Builds system prompts from discovered actions for the local LLM.
 * The prompt constrains the LLM to output strict JSON with semantic action names only.
 * When pageData is provided, the LLM can also answer informational questions.
 */
export function buildSystemPrompt(catalog: ActionCatalog, pageData?: string): string {
  const actionDescriptions = catalog.actions.map(describeAction).join('\n\n');

  const pageDataBlock = pageData
    ? `\n\nData visible on this page:\n\n${pageData}`
    : '';

  return `You are an agent that helps users interact with web applications.
You MUST respond with a single JSON object. No text before or after the JSON.

Available actions on this page:

${actionDescriptions}${pageDataBlock}

RULES:
1. Respond with EXACTLY this JSON format: {"action": "<action_name>", "args": {<field_name>: <value>}}
2. Use ONLY action names and field names listed above. Never invent new ones.
3. NEVER include CSS selectors, XPath, or DOM references in your response.
4. If a field expects a specific type (number, email), use that type.
5. NEVER use null for any field value. If the user provides a name but a field expects an email, use "<name>@example.com" as a placeholder.
6. Always include ALL fields you can infer from the user's message. If a previous plan is provided, merge the new information with existing values — keep all fields from the previous plan that the user did not change.
7. If the user is asking an informational question (e.g. "what currencies are supported?", "what fields does this form have?") rather than requesting an action, respond with: {"action": "none", "answer": "<your concise answer based on the available actions and page data>"}
8. If you cannot map the user's request to an available action AND it is not an informational question, respond with: {"action": "none", "args": {}, "error": "reason"}
9. For destructive actions (high risk), include "confirmed": false in your response.
10. If the context says a form is awaiting review and the user wants to submit/send/confirm it, respond with the same action, same args, and "confirmed": true.`;
}

function describeAction(action: DiscoveredAction): string {
  const meta: string[] = [];
  if (action.danger) meta.push(`risk: ${action.danger}`);
  if (action.confirm) meta.push(`confirmation: ${action.confirm}`);
  if (action.scope) meta.push(`scope: ${action.scope}`);
  if (action.idempotent) meta.push(`idempotent: ${action.idempotent}`);

  const fields = action.fields
    .map((f) => {
      const opts = f.options?.length ? ` [options: ${f.options.join(', ')}]` : '';
      return `    - ${f.field} (${f.tagName})${opts}`;
    })
    .join('\n');

  return `ACTION: ${action.action}
  ${meta.join(' | ')}
  Fields:
${fields || '    (none)'}`;
}

/**
 * Builds the user prompt that wraps the user's natural language message.
 */
export function buildUserPrompt(userMessage: string): string {
  return `User request: "${userMessage}"

Respond with a JSON object mapping this request to one of the available actions.`;
}

/**
 * Builds a site-aware system prompt that includes both current-page actions (full detail)
 * and other-page actions (lighter summary from manifest). Also includes navigable pages
 * for navigation-only requests. The runtime handles cross-page navigation.
 */
export function buildSiteAwarePrompt(
  catalog: ActionCatalog,
  otherPageActions: ManifestActionSummary[],
  pages: PageSummary[],
  pageData?: string,
  dataViews?: DataViewSummary[],
  discoveredLinks?: DiscoveredLink[],
): string {
  const currentPageDescriptions = catalog.actions.map(describeAction).join('\n\n');

  const otherPageDescriptions = otherPageActions
    .map(describeManifestAction)
    .join('\n\n');

  const pageDataBlock = pageData
    ? `\n\nData visible on this page:\n\n${pageData}`
    : '';

  const otherPageBlock = otherPageDescriptions
    ? `\n\nActions on other pages (the runtime will navigate automatically):\n\n${otherPageDescriptions}`
    : '';

  const dataViewBlock = dataViews && dataViews.length > 0
    ? `\n\nQueryable data views (use {"action": "<data_view_name>", "args": {<query_params>}} to query):\n\n${dataViews.map(describeDataView).join('\n\n')}`
    : '';

  const pageListBlock = pages.length > 0
    ? '\n\nNavigable pages:\n' + pages.map(describePageSummary).join('\n')
    : '';

  const linksBlock = discoveredLinks && discoveredLinks.length > 0
    ? '\n\nLinks visible on this page:\n' + discoveredLinks.map(describeLinkSummary).join('\n')
    : '';

  return `You are an agent that helps users interact with web applications.
You MUST respond with a single JSON object. No text before or after the JSON.

Available actions on this page:

${currentPageDescriptions}${otherPageBlock}${dataViewBlock}${pageListBlock}${linksBlock}${pageDataBlock}

RULES:
1. Respond with EXACTLY this JSON format: {"action": "<action_name>", "args": {<field_name>: <value>}}
2. Use ONLY action names and field names listed above. Never invent new ones.
3. NEVER include CSS selectors, XPath, or DOM references in your response.
4. If a field expects a specific type (number, email), use that type.
5. NEVER use null for any field value. If the user provides a name but a field expects an email, use "<name>@example.com" as a placeholder.
6. Always include ALL fields you can infer from the user's message. If a previous plan is provided, merge the new information with existing values — keep all fields from the previous plan that the user did not change.
7. If the user is asking an informational question (e.g. "what currencies are supported?", "what fields does this form have?") rather than requesting an action, respond with: {"action": "none", "answer": "<your concise answer based on the available actions and page data>"}
8. If you cannot map the user's request to an available action AND it is not an informational question, respond with: {"action": "none", "args": {}, "error": "reason"}
9. For destructive actions (high risk), include "confirmed": false in your response.
10. If the context says a form is awaiting review and the user wants to submit/send/confirm it, respond with the same action, same args, and "confirmed": true.
11. If the requested action is on another page, still return it. The runtime handles navigation automatically.
12. If the user only wants to navigate to a page without executing an action (e.g. "go to invoices", "show me settings", "take me to the invoice form"), respond with: {"navigate": "<page_route>"}. Use exact routes from the navigable pages list or links visible on this page. NEVER guess or invent routes.
13. For queryable data views, use the same format: {"action": "<data_view_name>", "args": {<query_params>}}. Only include query params the user specified. The runtime navigates to the data view page with filters applied.`;
}

function describePageSummary(page: PageSummary): string {
  const content: string[] = [];
  if (page.hasActions) content.push('actions');
  if (page.hasData) content.push('data');
  const desc = page.description ? ` — ${page.description}` : '';
  return `- ${page.route} — "${page.title}" (${content.join(' + ') || 'empty'})${desc}`;
}

function describeManifestAction(summary: ManifestActionSummary): string {
  const meta: string[] = [];
  if (summary.risk) meta.push(`risk: ${summary.risk}`);
  if (summary.confirmation) meta.push(`confirmation: ${summary.confirmation}`);

  const fields = summary.fields.length > 0
    ? summary.fields.map((f) => {
        const sem = f.semantic ? ` [${f.semantic.replace('https://schema.org/', 'schema.org/')}]` : '';
        return `    - ${f.name}${sem}`;
      }).join('\n')
    : '    (none)';

  return `ACTION: ${summary.action} (on ${summary.page} — "${summary.pageTitle}")
  ${summary.title}${summary.description ? ` — ${summary.description}` : ''}
  ${meta.join(' | ')}
  Fields:
${fields}`;
}

function describeLinkSummary(link: DiscoveredLink): string {
  const label = link.textContent ? ` — "${link.textContent}"` : '';
  return `- ${link.page}${label}`;
}

function describeDataView(summary: DataViewSummary): string {
  const fields = summary.fields.length > 0
    ? summary.fields.map((f) => {
        const sem = f.semantic ? ` [${f.semantic.replace('https://schema.org/', 'schema.org/')}]` : '';
        return `    - ${f.name}${sem}`;
      }).join('\n')
    : '    (none)';

  return `DATA VIEW: ${summary.dataView} (on ${summary.page} — "${summary.pageTitle}")
  ${summary.title}${summary.description ? ` — ${summary.description}` : ''}
  Query parameters:
${fields}`;
}
