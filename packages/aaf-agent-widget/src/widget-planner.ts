import type { ActionCatalog, DiscoveredLink } from '@agent-accessibility-framework/runtime-core';
import { buildSystemPrompt, buildUserPrompt, buildSiteAwarePrompt } from '@agent-accessibility-framework/planner-local';
import type { ManifestActionSummary, PageSummary, DataViewSummary, LlmBackend } from '@agent-accessibility-framework/planner-local';
import { parseResponse, type ParsedPlannerResult, type ParseResponseOptions } from '@agent-accessibility-framework/planner-local';

const MAX_RETRIES = 4;

export interface PlanDebugInfo {
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
  attempts: number;
  latencyMs: number;
}

export interface PlanResultWithDebug {
  result: ParsedPlannerResult;
  debug: PlanDebugInfo;
}

/** Error subclass that carries debug info from a failed planning attempt */
export class PlannerError extends Error {
  debug: PlanDebugInfo;
  constructor(message: string, debug: PlanDebugInfo) {
    super(message);
    this.name = 'PlannerError';
    this.debug = debug;
  }
}

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

  async plan(userMessage: string, catalog: ActionCatalog, pageData?: string): Promise<PlanResultWithDebug> {
    const systemPrompt = buildSystemPrompt(catalog, pageData);
    const userPrompt = buildUserPrompt(userMessage);
    const startTime = performance.now();
    const validActions = catalog.actions.map((a) => a.action);
    const validActionFields: Record<string, string[]> = {};
    for (const a of catalog.actions) {
      validActionFields[a.action] = a.fields.map((f) => f.field);
    }
    const parseOpts: ParseResponseOptions = {
      ...(validActions.length > 0 ? { validActions } : {}),
      ...(Object.keys(validActionFields).length > 0 ? { validActionFields } : {}),
    };

    const actionList = validActions.length > 0
      ? `\nAvailable actions: ${validActions.join(', ')}`
      : '';

    let lastError: Error | null = null;
    let lastRaw = '';
    let lastPrompt = userPrompt;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const prompt = attempt === 0 || !lastError
          ? userPrompt
          : `${userPrompt}\n\nCORRECTION: Your previous response was rejected: ${lastError.message}. You MUST use one of these exact action names: ${validActions.join(', ')}. Respond with valid JSON.${actionList}`;
        lastPrompt = prompt;
        const raw = await this.backend.generate(prompt, systemPrompt, { json: true });
        lastRaw = raw;
        const result = parseResponse(raw, parseOpts);
        return {
          result,
          debug: {
            systemPrompt,
            userPrompt: prompt,
            rawResponse: raw,
            attempts: attempt + 1,
            latencyMs: Math.round(performance.now() - startTime),
          },
        };
      } catch (err) {
        lastError = err as Error;
        if (isNonRetryable(lastError)) throw lastError;
      }
    }

    throw new PlannerError(`Planner failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`, {
      systemPrompt,
      userPrompt: lastPrompt,
      rawResponse: lastRaw,
      attempts: MAX_RETRIES + 1,
      latencyMs: Math.round(performance.now() - startTime),
    });
  }

  async planSiteAware(
    userMessage: string,
    catalog: ActionCatalog,
    otherPageActions: ManifestActionSummary[],
    pages: PageSummary[],
    pageData?: string,
    dataViews?: DataViewSummary[],
    discoveredLinks?: DiscoveredLink[],
  ): Promise<PlanResultWithDebug> {
    const systemPrompt = buildSiteAwarePrompt(catalog, otherPageActions, pages, pageData, dataViews, discoveredLinks);
    const userPrompt = buildUserPrompt(userMessage);
    const startTime = performance.now();

    const validRoutes = [
      ...pages.filter((p) => !p.route.includes(':')).map((p) => p.route),
      ...(discoveredLinks ?? []).map((l) => l.page),
    ];
    const validActions = [
      ...catalog.actions.map((a) => a.action),
      ...otherPageActions.map((a) => a.action),
    ];
    const validActionFields: Record<string, string[]> = {};
    for (const a of catalog.actions) {
      validActionFields[a.action] = a.fields.map((f) => f.field);
    }
    for (const a of otherPageActions) {
      validActionFields[a.action] = a.fields.map((f) => f.name);
    }
    const linksList = (discoveredLinks ?? [])
      .filter((l) => l.textContent)
      .map((l) => ({ page: l.page, text: l.textContent! }));
    const parseOpts: ParseResponseOptions = {
      ...(validRoutes.length > 0 ? { validRoutes } : {}),
      ...(validActions.length > 0 ? { validActions } : {}),
      ...(Object.keys(validActionFields).length > 0 ? { validActionFields } : {}),
      ...(linksList.length > 0 ? { discoveredLinks: linksList } : {}),
    };

    let lastError: Error | null = null;
    let lastRaw = '';
    let lastPrompt = userPrompt;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const prompt = attempt === 0 || !lastError
          ? userPrompt
          : `${userPrompt}\n\nCORRECTION: Your previous response was rejected: ${lastError.message}. You MUST use one of these exact action names: ${validActions.join(', ')}. Respond with valid JSON.`;
        lastPrompt = prompt;
        const raw = await this.backend.generate(prompt, systemPrompt, { json: true });
        lastRaw = raw;
        const result = parseResponse(raw, parseOpts);
        return {
          result,
          debug: {
            systemPrompt,
            userPrompt: prompt,
            rawResponse: raw,
            attempts: attempt + 1,
            latencyMs: Math.round(performance.now() - startTime),
          },
        };
      } catch (err) {
        lastError = err as Error;
        if (isNonRetryable(lastError)) throw lastError;
      }
    }

    throw new PlannerError(`Planner failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`, {
      systemPrompt,
      userPrompt: lastPrompt,
      rawResponse: lastRaw,
      attempts: MAX_RETRIES + 1,
      latencyMs: Math.round(performance.now() - startTime),
    });
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
