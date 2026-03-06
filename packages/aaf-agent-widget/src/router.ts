import type { AgentManifest, DiscoveredLink } from '@agent-accessibility-framework/runtime-core';

export interface RouteMatch {
  action: string;
  page: string;
  score: number;
}

export interface NavigationMatch {
  page: string;
  title: string;
  score: number;
}

/** Minimum score threshold for a match to be considered valid. */
const MIN_SCORE = 2;

/**
 * Tokenize a string into lowercase words, splitting on non-alphanumeric characters.
 */
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
}

/**
 * Score an action against user message tokens via keyword overlap.
 * Counts how many user tokens appear in the action's title, description,
 * field names, and action name segments.
 */
function scoreAction(
  userTokens: string[],
  actionName: string,
  title: string,
  description?: string,
  fieldNames?: string[],
): number {
  // Build a bag of words from all action metadata
  const bag = new Set<string>();

  for (const token of tokenize(actionName)) bag.add(token);
  for (const token of tokenize(title)) bag.add(token);
  if (description) {
    for (const token of tokenize(description)) bag.add(token);
  }
  if (fieldNames) {
    for (const field of fieldNames) {
      for (const token of tokenize(field)) bag.add(token);
    }
  }

  let score = 0;
  for (const token of userTokens) {
    if (bag.has(token)) score++;
  }

  return score;
}

/**
 * Match user intent to an off-page action using keyword scoring.
 * Only considers manifest actions NOT in `currentPageActions`.
 * Returns the best match above the minimum threshold, or null.
 *
 * Pure string matching — no LLM involved.
 */
export function matchIntentToPage(
  userMessage: string,
  manifest: AgentManifest,
  currentPageActions: string[],
): RouteMatch | null {
  const userTokens = tokenize(userMessage);
  if (userTokens.length === 0) return null;

  const currentSet = new Set(currentPageActions);
  let best: RouteMatch | null = null;

  for (const [actionName, action] of Object.entries(manifest.actions)) {
    if (currentSet.has(actionName)) continue;

    // Find the page for this action
    let page: string | undefined;
    if (manifest.pages) {
      for (const [route, pageEntry] of Object.entries(manifest.pages)) {
        if (pageEntry.actions?.includes(actionName)) {
          page = route;
          break;
        }
      }
    }
    if (!page) continue;

    const fieldNames = action.inputSchema?.properties
      ? Object.keys(action.inputSchema.properties as Record<string, unknown>)
      : undefined;

    const score = scoreAction(
      userTokens,
      actionName,
      action.title,
      action.description,
      fieldNames,
    );

    if (score >= MIN_SCORE && (!best || score > best.score)) {
      best = { action: actionName, page, score };
    }
  }

  return best;
}

/**
 * Minimum score threshold for page/link navigation matching.
 * Lower than MIN_SCORE for actions because page titles are typically short (1-2 words).
 */
const NAV_MIN_SCORE = 1;

/**
 * Match user intent to a navigable page using keyword scoring against
 * manifest page titles, routes, and discovered link text.
 * Pure string matching — no LLM involved.
 *
 * Use this for navigation-only intents (e.g., "go to projects") that
 * don't match any action keywords.
 */
export function matchIntentToNavigation(
  userMessage: string,
  manifest: AgentManifest,
  discoveredLinks: DiscoveredLink[],
  currentPath: string,
): NavigationMatch | null {
  const userTokens = tokenize(userMessage);
  if (userTokens.length === 0) return null;

  const normalizedCurrent = currentPath.replace(/\/$/, '');
  let best: NavigationMatch | null = null;

  // Score manifest pages
  if (manifest.pages) {
    for (const [route, page] of Object.entries(manifest.pages)) {
      if (route.replace(/\/$/, '') === normalizedCurrent) continue;
      // Skip parameterized routes (can't navigate without specific IDs)
      if (route.includes(':')) continue;

      const bag = new Set<string>();
      for (const token of tokenize(page.title)) bag.add(token);
      if (page.description) {
        for (const token of tokenize(page.description)) bag.add(token);
      }
      for (const token of tokenize(route)) bag.add(token);

      let score = 0;
      for (const token of userTokens) {
        if (bag.has(token)) score++;
      }

      if (score >= NAV_MIN_SCORE && (!best || score > best.score)) {
        best = { page: route, title: page.title, score };
      }
    }
  }

  // Score discovered links (DOM-level navigation targets)
  for (const link of discoveredLinks) {
    if (link.page.replace(/\/$/, '') === normalizedCurrent) continue;
    if (link.page.includes(':')) continue;

    const bag = new Set<string>();
    if (link.textContent) {
      for (const token of tokenize(link.textContent)) bag.add(token);
    }
    for (const token of tokenize(link.page)) bag.add(token);

    let score = 0;
    for (const token of userTokens) {
      if (bag.has(token)) score++;
    }

    if (score >= NAV_MIN_SCORE && (!best || score > best.score)) {
      const title = link.textContent || link.page;
      best = { page: link.page, title, score };
    }
  }

  return best;
}
