import type { LlmBackend } from './types.js';

/**
 * LlmBackend implementation for Ollama's local API.
 */
export class OllamaBackend implements LlmBackend {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.2') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generate(userPrompt: string, systemPrompt: string, opts?: { json?: boolean }): Promise<string> {
    const json = opts?.json ?? true;

    const body: Record<string, unknown> = {
      model: this.model,
      prompt: userPrompt,
      system: systemPrompt,
      stream: false,
      options: { temperature: 0.1 },
    };
    if (json) body.format = 'json';

    const res = await fetch(`${this.baseUrl}/api/generate`, {
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

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  name(): string {
    return 'Ollama';
  }
}
