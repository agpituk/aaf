import type { LlmBackend } from '@agent-accessibility-framework/planner-local';
import { OllamaBackend, OpenAiCompatibleBackend } from '@agent-accessibility-framework/planner-local';

export interface AAFWidgetConfig {
  llm?: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
}

declare global {
  interface Window {
    __AAF_CONFIG__?: AAFWidgetConfig;
  }
}

/**
 * Read widget configuration from two sources (checked in order):
 * 1. window.__AAF_CONFIG__
 * 2. data-llm-* attributes on the widget's <script> tag
 * 3. Default: Ollama at localhost:11434
 */
export function readConfig(): AAFWidgetConfig {
  // Source 1: global config object
  if (typeof window !== 'undefined' && window.__AAF_CONFIG__?.llm) {
    return window.__AAF_CONFIG__;
  }

  // Source 2: script tag data attributes
  if (typeof document !== 'undefined') {
    const scripts = document.querySelectorAll('script[data-llm-provider]');
    if (scripts.length > 0) {
      const script = scripts[scripts.length - 1] as HTMLScriptElement;
      return {
        llm: {
          provider: script.dataset.llmProvider,
          baseUrl: script.dataset.llmBaseUrl,
          model: script.dataset.llmModel,
          apiKey: script.dataset.llmApiKey,
        },
      };
    }
  }

  // Default: no explicit config (will fall back to Ollama detection)
  return {};
}

/**
 * Create an LlmBackend from config. Returns null if no backend is available.
 */
export async function detectAvailableBackend(config: AAFWidgetConfig): Promise<LlmBackend | null> {
  const llm = config.llm;

  // If a specific provider is configured, try that first
  if (llm?.provider === 'openai' && llm.baseUrl && llm.apiKey && llm.model) {
    const backend = new OpenAiCompatibleBackend({
      baseUrl: llm.baseUrl,
      apiKey: llm.apiKey,
      model: llm.model,
    });
    if (await backend.isAvailable()) return backend;
  }

  if (llm?.provider === 'ollama') {
    const backend = new OllamaBackend(
      llm.baseUrl || 'http://localhost:11434',
      llm.model || 'llama3.2',
    );
    if (await backend.isAvailable()) return backend;
  }

  // Default: try Ollama at localhost
  const ollama = new OllamaBackend();
  if (await ollama.isAvailable()) return ollama;

  return null;
}
