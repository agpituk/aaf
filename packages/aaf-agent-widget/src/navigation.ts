import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';
import { getPageForAction } from '@agent-accessibility-framework/runtime-core';
import type { ManifestActionSummary, PageSummary } from '@agent-accessibility-framework/planner-local';
import type { FieldSummary, DataViewSummary } from '@agent-accessibility-framework/planner-local';

export const NAV_STORAGE_KEY = 'aaf-widget-pending-nav';
const NAV_STALENESS_MS = 30_000;

export interface PendingNavigation {
  userMessage: string;
  conversationHistory: Array<{ role: string; text: string }>;
  targetPage: string;
  timestamp: number;
  /** True when the user's intent was navigation only (no action to execute on arrival). */
  navigateOnly?: boolean;
}

/**
 * Build ManifestActionSummary[] for actions NOT on the current page.
 * Iterates manifest.actions, skips those in currentPageActionNames,
 * looks up the page via getPageForAction, and extracts field names from inputSchema.
 */
export function buildSiteActions(
  manifest: AgentManifest,
  currentPageActionNames: string[],
): ManifestActionSummary[] {
  const results: ManifestActionSummary[] = [];

  for (const [actionName, action] of Object.entries(manifest.actions)) {
    if (currentPageActionNames.includes(actionName)) continue;

    const page = getPageForAction(manifest, actionName);
    if (!page) continue;

    const pageEntry = manifest.pages?.[page];
    if (!pageEntry) continue;

    const fields = extractFieldSummaries(action.inputSchema?.properties as Record<string, Record<string, unknown>> | undefined);

    results.push({
      action: actionName,
      title: action.title,
      description: action.description,
      page,
      pageTitle: pageEntry.title,
      risk: action.risk,
      confirmation: action.confirmation,
      fields,
    });
  }

  return results;
}

/**
 * Build PageSummary[] for all pages in the manifest (excluding the current page).
 * Used to tell the LLM what pages are navigable.
 */
export function buildPageSummaries(
  manifest: AgentManifest,
  currentPath: string,
): PageSummary[] {
  if (!manifest.pages) return [];

  const normalizedCurrent = currentPath.replace(/\/$/, '');
  const results: PageSummary[] = [];

  for (const [route, page] of Object.entries(manifest.pages)) {
    if (route.replace(/\/$/, '') === normalizedCurrent) continue;

    results.push({
      route,
      title: page.title,
      description: page.description,
      hasActions: (page.actions?.length ?? 0) > 0,
      hasData: (page.data?.length ?? 0) > 0,
    });
  }

  return results;
}

/**
 * Extract FieldSummary[] from a JSON Schema properties object.
 * Reads the `x-semantic` annotation if present.
 */
function extractFieldSummaries(
  properties: Record<string, Record<string, unknown>> | undefined,
): FieldSummary[] {
  if (!properties) return [];
  return Object.entries(properties).map(([name, schema]) => {
    const semantic = typeof schema['x-semantic'] === 'string' ? schema['x-semantic'] : undefined;
    return semantic ? { name, semantic } : { name };
  });
}

/**
 * Build DataViewSummary[] for queryable data views (those with inputSchema) from the manifest.
 * Only includes data views that have query parameters defined.
 */
export function buildSiteDataViews(manifest: AgentManifest): DataViewSummary[] {
  if (!manifest.data || !manifest.pages) return [];

  const results: DataViewSummary[] = [];

  for (const [dvName, dv] of Object.entries(manifest.data)) {
    // Only include data views that have an inputSchema (queryable)
    if (!dv.inputSchema) continue;

    // Find the page this data view belongs to
    let dvPage: string | undefined;
    let dvPageTitle: string | undefined;
    for (const [route, page] of Object.entries(manifest.pages)) {
      if (page.data?.includes(dvName)) {
        dvPage = route;
        dvPageTitle = page.title;
        break;
      }
    }
    if (!dvPage || !dvPageTitle) continue;

    const fields = extractFieldSummaries(
      (dv.inputSchema as Record<string, unknown>).properties as Record<string, Record<string, unknown>> | undefined,
    );

    results.push({
      dataView: dvName,
      title: dv.title,
      description: dv.description,
      page: dvPage,
      pageTitle: dvPageTitle,
      fields,
    });
  }

  return results;
}

/**
 * Resolve an LLM-suggested navigation path against known routes.
 * LLMs often hallucinate shortened paths (e.g., "/appearance" instead of "/settings/appearance").
 * This function tries exact match first, then suffix match against known routes.
 * Returns the corrected path, or the original if no match is found.
 */
export function resolveNavigationTarget(
  suggestedPath: string,
  knownRoutes: string[],
): string {
  const normalized = suggestedPath.endsWith('/') ? suggestedPath : suggestedPath + '/';
  const normalizedNoSlash = normalized.replace(/\/$/, '');

  // Exact match (with or without trailing slash)
  for (const route of knownRoutes) {
    const routeNorm = route.endsWith('/') ? route : route + '/';
    if (routeNorm === normalized || route === normalizedNoSlash) {
      return route;
    }
  }

  // Suffix match — "/appearance" matches "/settings/appearance"
  const suffix = normalizedNoSlash; // e.g., "/appearance"
  const matches = knownRoutes.filter((route) => {
    const routeNorm = route.replace(/\/$/, '');
    return routeNorm.endsWith(suffix) && routeNorm !== suffix;
  });

  if (matches.length === 1) {
    return matches[0];
  }

  // No match or ambiguous — return original
  return suggestedPath;
}

/** Persist navigation intent to sessionStorage so the widget can resume after page load. */
export function persistNavigation(
  targetPage: string,
  userMessage: string,
  history: Array<{ role: string; text: string }>,
  navigateOnly?: boolean,
): void {
  try {
    const pending: PendingNavigation = {
      userMessage,
      conversationHistory: history,
      targetPage,
      timestamp: Date.now(),
      navigateOnly,
    };
    sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // sessionStorage unavailable (private browsing restrictions, non-window context, etc.)
  }
}

/**
 * Check for a pending navigation from sessionStorage.
 * Returns null if missing, malformed, or stale (>30s).
 * Clears the entry after reading to prevent double-processing.
 */
export function checkPendingNavigation(): PendingNavigation | null {
  try {
    const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
    sessionStorage.removeItem(NAV_STORAGE_KEY);

    if (!raw) return null;

    let pending: PendingNavigation;
    try {
      pending = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!pending.userMessage || !pending.targetPage || !pending.timestamp) {
      return null;
    }

    if (Date.now() - pending.timestamp > NAV_STALENESS_MS) {
      return null;
    }

    return pending;
  } catch {
    // sessionStorage unavailable
    return null;
  }
}
