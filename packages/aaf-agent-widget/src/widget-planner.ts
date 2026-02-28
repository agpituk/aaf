import type { ActionCatalog, DiscoveredLink } from '@agent-accessibility-framework/runtime-core';
import { buildSystemPrompt, buildUserPrompt, buildSiteAwarePrompt } from '@agent-accessibility-framework/planner-local';
import type { ManifestActionSummary, PageSummary, DataViewSummary, LlmBackend } from '@agent-accessibility-framework/planner-local';
import { parseResponse, type ParsedPlannerResult, type ParseResponseOptions } from '@agent-accessibility-framework/planner-local';

const MAX_RETRIES = 2;

/** Errors that should not be retried (network failures, API auth errors, etc.) */
function isNonRetryable(err: Error): boolean {
  const msg = err.message;
  return msg.includes('API error') || msg.includes('No LLM backend') || msg.includes('Network error') || msg.includes('fetch');
}

/**
 * Generic planner that works with any LlmBackend.
 * Drop-in replacement for OllamaPlanner with backend flexibility.
 */
export class WidgetPlanner {
  protected backend: LlmBackend;

  constructor(backend: LlmBackend) {
    this.backend = backend;
  }

  async plan(userMessage: string, catalog: ActionCatalog, pageData?: string): Promise<ParsedPlannerResult> {
    const systemPrompt = buildSystemPrompt(catalog, pageData);
    const userPrompt = buildUserPrompt(userMessage);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await this.backend.generate(userPrompt, systemPrompt, { json: true });
        return parseResponse(raw);
      } catch (err) {
        lastError = err as Error;
        if (isNonRetryable(lastError)) throw lastError;
      }
    }

    throw new Error(`Planner failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  }

  async planSiteAware(
    userMessage: string,
    catalog: ActionCatalog,
    otherPageActions: ManifestActionSummary[],
    pages: PageSummary[],
    pageData?: string,
    dataViews?: DataViewSummary[],
    discoveredLinks?: DiscoveredLink[],
  ): Promise<ParsedPlannerResult> {
    const systemPrompt = buildSiteAwarePrompt(catalog, otherPageActions, pages, pageData, dataViews, discoveredLinks);
    const userPrompt = buildUserPrompt(userMessage);

    const validRoutes = [
      ...pages.map((p) => p.route),
      ...(discoveredLinks ?? []).map((l) => l.page),
    ];
    const parseOpts: ParseResponseOptions = validRoutes.length > 0 ? { validRoutes } : {};

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await this.backend.generate(userPrompt, systemPrompt, { json: true });
        return parseResponse(raw, parseOpts);
      } catch (err) {
        lastError = err as Error;
        if (isNonRetryable(lastError)) throw lastError;
      }
    }

    throw new Error(`Planner failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  }

  async query(question: string, context: string): Promise<string> {
    const systemPrompt =
      'You are an assistant that answers questions about data on a web page. ' +
      'Here is the data:\n\n' + context + '\n\nAnswer concisely based only on the data provided.';
    return this.backend.generate(question, systemPrompt, { json: false });
  }

  async detectBackend(): Promise<string> {
    if (await this.backend.isAvailable()) return this.backend.name();
    return 'none';
  }
}
