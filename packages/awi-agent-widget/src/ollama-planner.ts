import type { ActionCatalog } from '@agent-native-web/runtime-core';
import type { PlannerRequest } from '@agent-native-web/awi-contracts';
import { buildSystemPrompt, buildUserPrompt } from '@agent-native-web/planner-local';
import { parseResponse, type ParsedPlannerResult } from '@agent-native-web/planner-local';

const MAX_RETRIES = 2;
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.2';

/**
 * Ollama-based planner for LLM inference via local Ollama server.
 * Falls back to inspector-only mode when Ollama is unavailable.
 */
export class OllamaPlanner {
  async plan(userMessage: string, catalog: ActionCatalog, pageData?: string): Promise<ParsedPlannerResult> {
    const systemPrompt = buildSystemPrompt(catalog, pageData);
    const userPrompt = buildUserPrompt(userMessage);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await this.generate(userPrompt, systemPrompt);
        return parseResponse(raw);
      } catch (err) {
        lastError = err as Error;
        // Don't retry on API connectivity errors
        if (lastError.message.includes('API error') || lastError.message.includes('No LLM backend')) {
          throw lastError;
        }
      }
    }

    throw new Error(`Planner failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  }

  /** Answer a free-form question using page data as context */
  async query(question: string, context: string): Promise<string> {
    const systemPrompt =
      'You are an assistant that answers questions about data on a web page. ' +
      'Here is the data:\n\n' + context + '\n\nAnswer concisely based only on the data provided.';
    return this.generate(question, systemPrompt, { json: false });
  }

  /** Check whether Ollama is available */
  async detectBackend(): Promise<'ollama' | 'none'> {
    if (await this.isOllamaAvailable()) return 'ollama';
    return 'none';
  }

  private async generate(userPrompt: string, systemPrompt: string, opts?: { json?: boolean }): Promise<string> {
    const json = opts?.json ?? true;

    if (await this.isOllamaAvailable()) {
      return this.generateWithOllama(userPrompt, systemPrompt, json);
    }

    throw new Error('No LLM backend available. Install and run Ollama locally (https://ollama.com).');
  }

  private async isOllamaAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async generateWithOllama(userPrompt: string, systemPrompt: string, json = true): Promise<string> {
    const body: Record<string, unknown> = {
      model: OLLAMA_MODEL,
      prompt: userPrompt,
      system: systemPrompt,
      stream: false,
      options: { temperature: 0.1 },
    };
    if (json) body.format = 'json';

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.response;
  }
}
