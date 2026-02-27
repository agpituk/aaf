/**
 * Common interface for LLM backends used by the AAF planner and widget.
 * Implementations wrap specific APIs (Ollama, OpenAI-compatible, etc.).
 */
export interface LlmBackend {
  /** Generate a response from the LLM. When json=true, the backend should request JSON output format. */
  generate(userPrompt: string, systemPrompt: string, opts?: { json?: boolean }): Promise<string>;
  /** Check if the backend is reachable and ready. */
  isAvailable(): Promise<boolean>;
  /** Human-readable display name for the backend (e.g. "Ollama", "OpenAI"). */
  name(): string;
}
