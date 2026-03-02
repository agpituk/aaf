import { validatePlannerRequest, type PlannerResult } from '@agent-accessibility-framework/contracts';

/** @deprecated Use PlannerResult from @agent-accessibility-framework/contracts */
export type ParsedPlannerResult = PlannerResult;

export interface ParseResponseOptions {
  validRoutes?: string[];
  /** Known action names (e.g. ["session.login", "project.create"]) for fuzzy matching. */
  validActions?: string[];
  /** Action name → expected field names, for field name remapping after fuzzy action matching. */
  validActionFields?: Record<string, string[]>;
  /** Discovered links with text labels, for fuzzy navigation matching. */
  discoveredLinks?: Array<{ page: string; text: string }>;
}

/**
 * Validates that a navigation target is one of the known valid routes.
 * Strips trailing slashes from both sides before comparing.
 *
 * If the LLM returns a parameterized route (e.g. "/projects/:projectId"),
 * attempts to resolve it against concrete discovered links by pattern matching.
 * Returns the resolved route (which may differ from the input if resolution occurred).
 *
 * Throws a descriptive error if no match is found.
 */
function validateRoute(page: string, validRoutes: string[]): string {
  const normalize = (p: string) => p.replace(/\/+$/, '') || '/';
  const normalizedPage = normalize(page);

  // Direct match — return the original page
  for (const route of validRoutes) {
    if (normalize(route) === normalizedPage) return page;
  }

  // If this is a parameterized route (contains ":"), try to resolve it
  // against concrete links in the valid routes list
  if (page.includes(':')) {
    const pattern = new RegExp(
      '^' + normalizedPage.replace(/:[^/]+/g, '[^/]+') + '$',
    );
    const matches = validRoutes.filter((r) => pattern.test(normalize(r)));
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(
        `Parameterized route "${page}" matches multiple links: ${matches.join(', ')}. Pick a specific link from the Links list.`,
      );
    }
  }

  throw new Error(
    `Invalid navigation route "${page}" — not in valid routes: ${validRoutes.join(', ')}`,
  );
}

/**
 * Extracts and validates JSON from LLM output.
 * Handles common LLM quirks: markdown code blocks, preamble text, trailing text.
 *
 * Returns either an executable PlannerRequest or a direct answer for informational queries.
 */
export function parseResponse(raw: string, options?: ParseResponseOptions): ParsedPlannerResult {
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
    let page = normalizePath((parsed as Record<string, unknown>).navigate as string);
    if (!page) {
      throw new Error(`Invalid navigate target: "${(parsed as Record<string, unknown>).navigate}" — must be a path`);
    }
    if (options?.validRoutes && options.validRoutes.length > 0) {
      page = validateRoute(page, options.validRoutes);
    }
    return { kind: 'navigate', page };
  }

  // If LLM returned action="navigate" or a navigate-like action name
  // (e.g., "navigate_to_project", "go_to_settings") — common small-model quirk
  if (typeof parsed === 'object' && parsed !== null) {
    const action = (parsed as Record<string, unknown>).action;
    if (typeof action === 'string' && NAVIGATE_ACTION_PATTERN.test(action)) {
      const obj = parsed as Record<string, unknown>;
      const args = obj.args as Record<string, unknown> | undefined;

      // 1. Try extracting a page path from args (existing logic)
      let page = extractNavigatePage(args);

      // 2. Try extracting from ALL string properties (e.g., "target", "url", etc.)
      // Only accept values that look like actual URL paths, not arbitrary text
      if (!page) {
        for (const val of Object.values(obj)) {
          if (typeof val === 'string' && val !== action && looksLikePath(val)) {
            const normalized = normalizePath(val);
            if (normalized) { page = normalized; break; }
          }
        }
      }

      // 3. Fuzzy match text from response against discovered links
      if (!page && options?.discoveredLinks && options.discoveredLinks.length > 0) {
        page = fuzzyMatchLink(obj, options.discoveredLinks);
      }

      // 4. Extract keyword from action name and match against routes
      // e.g., "navigate_to_project" → "project" → match /projects/
      if (!page && options?.validRoutes && options.validRoutes.length > 0) {
        page = matchRouteByActionKeyword(action, options.validRoutes);
      }

      if (page) {
        if (options?.validRoutes && options.validRoutes.length > 0) {
          page = validateRoute(page, options.validRoutes);
        }
        return { kind: 'navigate', page };
      }
      throw new Error('Invalid navigate request — could not determine target page');
    }
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

  // Normalize common small-model quirks before validation
  normalizeActionResponse(parsed, options?.validActions, options?.validActionFields);

  // Reject unknown actions early (after fuzzy matching) so the retry loop
  // can include a helpful error listing valid action names
  if (
    typeof parsed === 'object' && parsed !== null
    && options?.validActions && options.validActions.length > 0
  ) {
    const action = (parsed as Record<string, unknown>).action;
    if (typeof action === 'string' && !options.validActions.includes(action)) {
      throw new Error(
        `Unknown action "${action}". Valid actions: ${options.validActions.join(', ')}`,
      );
    }
  }

  // Validate against contract
  const validation = validatePlannerRequest(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid planner request: ${validation.errors.join(', ')}`);
  }

  return { kind: 'action', request: parsed as PlannerRequest };
}

/**
 * Pattern to detect navigate-intent action names from small models.
 * Matches: "navigate", "navigate_to_project", "go_to_settings", "goto_page",
 *          "open_project", "view_settings", "show_dashboard"
 */
const NAVIGATE_ACTION_PATTERN = /^(navigate|go_?to|goto|open|view|show)($|[_\s])/i;

/**
 * Fuzzy-matches text from the LLM response against discovered link text.
 * Extracts meaningful words from all string values in the response object
 * and scores each link by how many words match its text content.
 */
function fuzzyMatchLink(
  obj: Record<string, unknown>,
  links: Array<{ page: string; text: string }>,
): string | null {
  // Collect all text from non-action string properties
  const textParts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'action') continue;
    if (typeof val === 'string') textParts.push(val);
  }
  // Also extract meaningful words from the action name
  const action = obj.action;
  if (typeof action === 'string') {
    // "navigate_to_project" → ["navigate", "to", "project"]
    const words = action.split(/[_\s]+/).filter((w) => !NAVIGATE_ACTION_PATTERN.test(w) && w.length > 2);
    textParts.push(words.join(' '));
  }

  if (textParts.length === 0) return null;

  const searchText = textParts.join(' ').toLowerCase();
  // Tokenize: extract words 3+ chars, skip common stop words
  const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'request', 'action', 'navigate']);
  const searchWords = searchText.match(/[a-z]{3,}/g)?.filter((w) => !STOP_WORDS.has(w)) ?? [];

  if (searchWords.length === 0) return null;

  let bestLink: string | null = null;
  let bestScore = 0;

  for (const link of links) {
    const linkText = link.text.toLowerCase();
    let score = 0;
    for (const word of searchWords) {
      if (linkText.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLink = link.page;
    }
  }

  // Require at least one meaningful word to match
  return bestScore > 0 ? bestLink : null;
}

/**
 * Extracts a keyword from a navigate-like action name and matches against routes.
 * e.g., "navigate_to_project" → "project" → matches "/projects/"
 * Only used as last resort when no better match is available.
 */
function matchRouteByActionKeyword(action: string, validRoutes: string[]): string | null {
  // Extract the target from the action name: "navigate_to_project" → "project"
  const cleaned = action.replace(NAVIGATE_ACTION_PATTERN, '').replace(/^[_\s]+/, '');
  if (!cleaned) return null;

  const keywords = cleaned.toLowerCase().split(/[_\s]+/).filter((w) => w.length > 2);
  if (keywords.length === 0) return null;

  // Find routes whose path contains any keyword
  const matches = validRoutes.filter((route) => {
    const routeLower = route.toLowerCase();
    return keywords.some((kw) => routeLower.includes(kw));
  });

  // Only return if exactly one match (ambiguous → let it fail)
  return matches.length === 1 ? matches[0] : null;
}

/** Alternative key names small models use instead of "args". */
const ARGS_ALIASES = ['parameters', 'params', 'arguments'];

/** The only allowed top-level keys in a PlannerRequest. */
const ALLOWED_KEYS = new Set(['action', 'args', 'confirmed']);

/** Verb synonym groups — verbs in the same group can substitute for each other. */
const VERB_SYNONYM_GROUPS: string[][] = [
  ['change', 'update', 'modify', 'edit', 'set', 'switch', 'alter', 'select'],
  ['filter', 'search', 'find', 'query'],
  ['create', 'add', 'new', 'make'],
  ['delete', 'remove', 'destroy', 'drop'],
  ['export', 'download'],
  ['import', 'upload'],
  ['list', 'get', 'read', 'fetch', 'load'],
  ['login', 'signin', 'authenticate'],
  ['logout', 'signout'],
  ['send', 'submit', 'post'],
];

/** Lookup: verb → set of synonyms (including itself). */
const VERB_SYNONYMS = new Map<string, Set<string>>();
for (const group of VERB_SYNONYM_GROUPS) {
  const groupSet = new Set(group);
  for (const verb of group) {
    VERB_SYNONYMS.set(verb, groupSet);
  }
}

/** Check if two words match via simple stemming (one is a prefix of the other, min 4 chars). */
function stemMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return longer.startsWith(shorter);
}

/**
 * Score how well an invented action name matches a valid AAF action name.
 * Uses verb-synonym matching (strong signal, +3) and word overlap (+1 each).
 * verbCandidates contains likely verb words from the invented name
 * (first word for underscore names, last-segment first word for dot names).
 */
function scoreActionMatch(inventedWords: string[], validAction: string, verbCandidates: string[]): number {
  const segments = validAction.split('.');
  const verbSegment = segments[segments.length - 1];
  const verbWords = verbSegment.split('_');
  const allActionWords = segments.flatMap((s) => s.split('_'));

  let score = 0;

  // Strong signal: any verb candidate is a synonym of the valid action's verb
  for (const candidate of verbCandidates) {
    if (verbWords.some((vw) => {
      const group = VERB_SYNONYMS.get(candidate);
      return group ? group.has(vw) : candidate === vw;
    })) {
      score += 3;
      break;
    }
  }

  // Word overlap: each invented word that matches an action word
  const counted = new Set<string>();
  for (const word of inventedWords) {
    for (const aw of allActionWords) {
      if (!counted.has(aw) && stemMatch(word, aw)) {
        score += 1;
        counted.add(aw);
        break;
      }
    }
  }

  return score;
}

/**
 * Word-overlap fuzzy matching for invented action names.
 * Returns the best matching valid action, or null if no confident match.
 * Requires a minimum score of 2 and a unique winner (no ties).
 */
function fuzzyMatchAction(invented: string, validActions: string[]): string | null {
  const inventedWords = invented.toLowerCase().split(/[_.\-\s]+/).filter((w) => w.length > 1);
  if (inventedWords.length === 0) return null;

  // Determine verb candidates: first word is typically the verb for underscore names.
  // For dot-notation invented names (e.g. "usage_filter.set_metric"), also extract
  // the verb from the last dot-segment (AAF convention: resource.verb).
  const verbCandidates = [inventedWords[0]];
  if (invented.includes('.')) {
    const lastSegment = invented.split('.').pop()!;
    const lastSegmentVerb = lastSegment.split('_')[0].toLowerCase();
    if (lastSegmentVerb.length > 1 && !verbCandidates.includes(lastSegmentVerb)) {
      verbCandidates.push(lastSegmentVerb);
    }
  }

  let bestAction: string | null = null;
  let bestScore = 0;
  let isTied = false;

  for (const action of validActions) {
    const score = scoreActionMatch(inventedWords, action, verbCandidates);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
      isTied = false;
    } else if (score === bestScore && score > 0 && action !== bestAction) {
      isTied = true;
    }
  }

  return bestScore >= 2 && !isTied ? bestAction : null;
}

/**
 * Remap arg keys to match expected field names using word overlap.
 * Handles models using wrong but similar field names (e.g., "filter_type" → "metric_type").
 */
function remapArgKeys(args: Record<string, unknown>, expectedFields: string[]): void {
  const argKeys = Object.keys(args);
  const matched = new Set(argKeys.filter((k) => expectedFields.includes(k)));
  const unmatchedArgs = argKeys.filter((k) => !matched.has(k));
  const unmatchedFields = expectedFields.filter((f) => !matched.has(f));

  if (unmatchedArgs.length === 0 || unmatchedFields.length === 0) return;

  for (const argKey of unmatchedArgs) {
    const argWords = argKey.toLowerCase().split('_');
    let bestField: string | null = null;
    let bestScore = 0;

    for (const field of unmatchedFields) {
      const fieldWords = field.toLowerCase().split('_');
      let score = 0;
      for (const aw of argWords) {
        for (const fw of fieldWords) {
          if (stemMatch(aw, fw)) score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestField && bestScore > 0) {
      args[bestField] = args[argKey];
      delete args[argKey];
      const idx = unmatchedFields.indexOf(bestField);
      if (idx !== -1) unmatchedFields.splice(idx, 1);
    }
  }
}

/**
 * Normalizes common small-model quirks in-place:
 * 1. Renames alternative arg keys (parameters, params, arguments) → args
 * 1b. Falls back to first unknown object-valued key as args
 * 1c. Collects flat scalar properties into args
 * 2. Parses stringified args
 * 3. Defaults missing args to empty object
 * 4. Fuzzy-matches action names (suffix match → word-overlap match)
 * 4c. Remaps arg keys to expected field names
 * 5. Strips unknown top-level properties
 */
function normalizeActionResponse(
  parsed: unknown,
  validActions?: string[],
  validActionFields?: Record<string, string[]>,
): void {
  if (typeof parsed !== 'object' || parsed === null) return;
  const obj = parsed as Record<string, unknown>;

  // 1. Rename alternative arg keys → args
  if (obj.args === undefined) {
    for (const alias of ARGS_ALIASES) {
      if (obj[alias] !== undefined) {
        obj.args = obj[alias];
        delete obj[alias];
        break;
      }
    }
  }

  // 1b. Fallback: if still no args, use the first unknown key whose value is
  // an object or stringified JSON. Handles creative key names like "credentials",
  // "data", "input", etc. that small models invent.
  if (obj.args === undefined) {
    for (const key of Object.keys(obj)) {
      if (ALLOWED_KEYS.has(key)) continue;
      const val = obj[key];
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        obj.args = val;
        delete obj[key];
        break;
      }
      if (typeof val === 'string' && val.startsWith('{')) {
        try {
          obj.args = JSON.parse(val);
          delete obj[key];
          break;
        } catch { /* not JSON, skip */ }
      }
    }
  }

  // 1c. Fallback: collect flat scalar properties into args.
  // Handles models that spread fields at top level:
  // {"action": "x", "field1": "val1", "field2": "val2"} → args = {field1, field2}
  if (obj.args === undefined) {
    const scalarArgs: Record<string, unknown> = {};
    const keysToDelete: string[] = [];
    for (const key of Object.keys(obj)) {
      if (ALLOWED_KEYS.has(key)) continue;
      const val = obj[key];
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        scalarArgs[key] = val;
        keysToDelete.push(key);
      }
    }
    if (Object.keys(scalarArgs).length > 0) {
      obj.args = scalarArgs;
      for (const key of keysToDelete) delete obj[key];
    }
  }

  // 2. Parse stringified args
  if (typeof obj.args === 'string') {
    try {
      obj.args = JSON.parse(obj.args);
    } catch { /* leave as-is, validation will catch it */ }
  }

  // 3. Ensure args exists (default to empty object)
  if (obj.args === undefined) {
    obj.args = {};
  }

  // 4. Fuzzy-match action names against valid actions
  if (typeof obj.action === 'string' && validActions && validActions.length > 0) {
    const action = obj.action;

    // Skip if already a valid action
    if (!validActions.includes(action)) {
      let matched = false;

      // 4a. Try exact suffix match for simple names: "login" → "session.login"
      if (!action.includes('.')) {
        const lower = action.toLowerCase();
        const suffixMatch = validActions.find((a) => a.endsWith(`.${lower}`));
        if (suffixMatch) {
          obj.action = suffixMatch;
          matched = true;
        }
      }

      // 4b. Word-overlap fuzzy match (handles multi-word invented names)
      if (!matched) {
        const overlapMatch = fuzzyMatchAction(action, validActions);
        if (overlapMatch) {
          obj.action = overlapMatch;
        }
      }
    }
  }

  // 4c. Remap arg keys to match expected field names
  if (
    typeof obj.action === 'string'
    && validActionFields
    && validActionFields[obj.action]
    && typeof obj.args === 'object'
    && obj.args !== null
  ) {
    remapArgKeys(obj.args as Record<string, unknown>, validActionFields[obj.action]);
  }

  // 5. Strip unknown top-level properties
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      delete obj[key];
    }
  }
}

/**
 * Quick check: does this string look like a URL path rather than natural language?
 * Matches: "/settings", "http://localhost/foo", "settings/profile"
 * Rejects: "go to Default Project", "navigate to page"
 */
function looksLikePath(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed.startsWith('/')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  // Relative path-like: no spaces, contains slash or looks like a single path segment
  if (!trimmed.includes(' ') && /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]*)*$/i.test(trimmed)) return true;
  return false;
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
