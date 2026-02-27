import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';
import { getPageForAction } from '@agent-accessibility-framework/runtime-core';
import type { ManifestActionSummary, PageSummary } from '@agent-accessibility-framework/planner-local';

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

    const fields = action.inputSchema?.properties
      ? Object.keys(action.inputSchema.properties as Record<string, unknown>)
      : [];

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
