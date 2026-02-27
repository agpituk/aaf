import { validatePlannerRequest, type PlannerResult } from '@agent-accessibility-framework/contracts';

/** @deprecated Use PlannerResult from @agent-accessibility-framework/contracts */
export type ParsedPlannerResult = PlannerResult;

/**
 * Extracts and validates JSON from LLM output.
 * Handles common LLM quirks: markdown code blocks, preamble text, trailing text.
 *
 * Returns either an executable PlannerRequest or a direct answer for informational queries.
 */
export function parseResponse(raw: string): ParsedPlannerResult {
  const json = extractJSON(raw);
  if (!json) {
    throw new Error(`Could not extract JSON from LLM response: ${raw.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid JSON in LLM response: ${json.slice(0, 200)}`);
  }

  // If LLM returned a navigate directive
  if (typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string, unknown>).navigate === 'string') {
    const page = normalizePath((parsed as Record<string, unknown>).navigate as string);
    if (!page) {
      throw new Error(`Invalid navigate target: "${(parsed as Record<string, unknown>).navigate}" — must be a path`);
    }
    return { kind: 'navigate', page };
  }

  // If LLM returned action="navigate" instead of {"navigate": "/path"} — common LLM quirk
  if (typeof parsed === 'object' && parsed !== null && (parsed as Record<string, unknown>).action === 'navigate') {
    const args = (parsed as Record<string, unknown>).args as Record<string, unknown> | undefined;
    const page = extractNavigatePage(args);
    if (page) {
      return { kind: 'navigate', page };
    }
    throw new Error('Invalid navigate request — args must include a recognizable page path');
  }

  // If LLM returned "none" action, check for an answer or throw error
  if (typeof parsed === 'object' && parsed !== null && (parsed as Record<string, unknown>).action === 'none') {
    const answer = (parsed as Record<string, unknown>).answer;
    if (typeof answer === 'string' && answer.length > 0) {
      return { kind: 'answer', text: answer };
    }
    const error = (parsed as Record<string, unknown>).error || 'LLM could not map request to an action';
    throw new Error(String(error));
  }

  // Validate against contract
  const validation = validatePlannerRequest(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid planner request: ${validation.errors.join(', ')}`);
  }

  return { kind: 'action', request: parsed as PlannerRequest };
}

/**
 * Normalizes an LLM-provided path to an absolute path.
 * Handles: "/invoices/new", "invoices/new", "http://localhost:5173/invoices/new"
 */
function normalizePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Full URL — extract pathname
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }

  // Already absolute
  if (trimmed.startsWith('/')) return trimmed;

  // Relative path — prepend /
  if (/^[a-z0-9]/i.test(trimmed)) return `/${trimmed}`;

  return null;
}

/**
 * Extracts a navigate target from args, trying common key names
 * and falling back to the first string value that looks like a path.
 */
function extractNavigatePage(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;

  // Try well-known keys first
  for (const key of ['page', 'route', 'path', 'target', 'url', 'destination', 'to']) {
    const val = args[key];
    if (typeof val === 'string') {
      const normalized = normalizePath(val);
      if (normalized) return normalized;
    }
  }

  // Fallback: first string value that looks like a path
  for (const val of Object.values(args)) {
    if (typeof val === 'string') {
      const normalized = normalizePath(val);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Extracts the first JSON object from a string, handling:
 * - Clean JSON: {"action": ...}
 * - Markdown-wrapped: ```json\n{...}\n```
 * - Preamble text: "Here's the plan:\n{...}"
 */
function extractJSON(text: string): string | null {
  // Try markdown code block first
  const mdMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (mdMatch) {
    return mdMatch[1].trim();
  }

  // Try to find a JSON object directly
  const braceStart = text.indexOf('{');
  if (braceStart === -1) return null;

  // Find matching closing brace
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(braceStart, i + 1);
      }
    }
  }

  return null;
}
