import type { LlmBackend, ToolDefinition, ToolCallResult } from './types.js';

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

  /** Fetch all locally available model names from Ollama. */
  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  /** Switch to a different model at runtime. */
  setModel(model: string): void {
    this.model = model;
  }

  /** Return the currently active model name. */
  currentModel(): string {
    return this.model;
  }

  /** Generate using native tool-use via Ollama's /api/chat endpoint. */
  async generateWithTools(
    userPrompt: string,
    systemPrompt: string,
    tools: ToolDefinition[],
  ): Promise<ToolCallResult> {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools,
      stream: false,
      options: { temperature: 0.1 },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const msg = data.message;

    if (msg.tool_calls?.length > 0) {
      const call = msg.tool_calls[0];
      return {
        toolCall: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      };
    }

    return { textResponse: msg.content };
  }
}
