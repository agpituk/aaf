import type { ActionCatalog, DiscoveredAction } from '@agent-accessibility-framework/runtime-core';
import type { ToolDefinition } from './types.js';

/**
 * Convert a dot-notation action name to a valid tool/function name.
 * OpenAI function names must match [a-zA-Z0-9_-]+, so dots become underscores.
 */
export function actionNameToToolName(actionName: string): string {
  return actionName.replace(/\./g, '_');
}

/**
 * Convert a tool/function name back to the original dot-notation action name.
 */
export function toolNameToActionName(toolName: string): string {
  return toolName.replace(/_/g, '.');
}

/**
 * Build a ToolDefinition from a single DiscoveredAction.
 * Uses manifest inputSchema when available, falling back to discovered field info.
 */
function buildToolFromAction(action: DiscoveredAction): ToolDefinition {
  const descParts: string[] = [];
  if (action.title) descParts.push(action.title);
  if (action.description) descParts.push(action.description);
  if (descParts.length === 0) descParts.push(`Execute ${action.action}`);

  // Build JSON Schema parameters from discovered fields
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of action.fields) {
    const prop: Record<string, unknown> = {};

    if (field.schemaType) {
      prop.type = field.schemaType;
    } else {
      prop.type = 'string';
    }

    if (field.enumValues && field.enumValues.length > 0) {
      prop.enum = field.enumValues;
    } else if (field.options && field.options.length > 0) {
      prop.enum = field.options;
    }

    if (field.format) {
      prop.format = field.format;
    }

    properties[field.field] = prop;

    if (field.required) {
      required.push(field.field);
    }
  }

  const parameters: Record<string, unknown> = {
    type: 'object',
    properties,
  };
  if (required.length > 0) {
    parameters.required = required;
  }
  if (action.strictFields) {
    parameters.additionalProperties = false;
  }

  return {
    type: 'function',
    function: {
      name: actionNameToToolName(action.action),
      description: descParts.join('. '),
      parameters,
    },
  };
}

/**
 * Convert an ActionCatalog into ToolDefinition[] for native function calling.
 * Each discovered action becomes one tool definition.
 */
export function catalogToTools(catalog: ActionCatalog): ToolDefinition[] {
  return catalog.actions.map(buildToolFromAction);
}

/**
 * Build a minimal system prompt for tool-use mode.
 * Much simpler than the prompt-builder's 14-rule system prompt — the tools
 * themselves carry the schema, so the LLM just needs basic instructions.
 */
export function buildToolSystemPrompt(pageData?: string): string {
  const lines = [
    'You are a web assistant. Use the provided tools to perform actions on this page.',
    'If the user asks about data on the page, answer directly from the context below.',
    'If no tool matches the request, respond with a helpful text message.',
  ];

  if (pageData) {
    lines.push('', 'Page data:', pageData);
  }

  return lines.join('\n');
}
