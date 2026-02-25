import { validatePlannerRequest, type PlannerRequest } from '@agent-native-web/awi-contracts';

/** Result from parseResponse — either an action to execute or a direct answer. */
export type ParsedPlannerResult =
  | { kind: 'action'; request: PlannerRequest }
  | { kind: 'answer'; text: string };

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
