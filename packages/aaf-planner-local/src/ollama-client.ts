/**
 * Thin HTTP client for Ollama's local API.
 */
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  format?: 'json';
  stream: false;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.2') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const body: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      system: systemPrompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 512,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data.response;
  }
}
