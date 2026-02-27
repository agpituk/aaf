import { OllamaBackend } from '@agent-accessibility-framework/planner-local';
import { WidgetPlanner } from './widget-planner.js';

/**
 * Backward-compatible planner that defaults to Ollama.
 * All logic lives in WidgetPlanner; this just wires in the OllamaBackend.
 */
export class OllamaPlanner extends WidgetPlanner {
  constructor() {
    super(new OllamaBackend());
  }

  /** Backward-compat: returns 'ollama' | 'none' */
  async detectBackend(): Promise<string> {
    const result = await super.detectBackend();
    return result === 'Ollama' ? 'ollama' : 'none';
  }
}
