import type { ActionCatalog } from '@agent-native-web/runtime-core';
import { OllamaClient } from './ollama-client.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
import { parseResponse, type ParsedPlannerResult } from './response-parser.js';

const MAX_RETRIES = 2;

/**
 * Local LLM planner that converts natural language to semantic action requests.
 * LLM only decides intent + args. Runtime decides execution.
 */
export class LocalPlanner {
  private client: OllamaClient;

  constructor(ollamaUrl?: string, model?: string) {
    this.client = new OllamaClient(ollamaUrl, model);
  }

  async plan(userMessage: string, catalog: ActionCatalog, pageData?: string): Promise<ParsedPlannerResult> {
    const systemPrompt = buildSystemPrompt(catalog, pageData);
    const userPrompt = buildUserPrompt(userMessage);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await this.client.generate(userPrompt, systemPrompt);
        return parseResponse(raw);
      } catch (err) {
        lastError = err as Error;
        // Only retry on parse/validation errors, not on API errors
        if (lastError.message.includes('Ollama API error')) {
          throw lastError;
        }
      }
    }

    throw new Error(`Planner failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  }
}
