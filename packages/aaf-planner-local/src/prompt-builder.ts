import type { ActionCatalog, DiscoveredAction } from '@agent-accessibility-framework/runtime-core';

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
9. For destructive actions (high risk), include "confirmed": false in your response.`;
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
