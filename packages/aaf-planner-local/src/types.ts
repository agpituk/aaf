/** Tool definition for native function-calling / tool-use APIs. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;        // e.g. "invoice_create" (no dots — OpenAI constraint)
    description: string;
    parameters: Record<string, unknown>; // JSON Schema from inputSchema
  };
}

/** Result from a tool-use / function-calling LLM call. */
export interface ToolCallResult {
  toolCall?: { name: string; arguments: Record<string, unknown> };
  textResponse?: string;  // when LLM responds with text instead of calling a tool
}

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
  /** List available models (if supported by the backend). */
  listModels?(): Promise<string[]>;
  /** Switch to a different model at runtime. */
  setModel?(model: string): void;
  /** Return the currently active model name. */
  currentModel?(): string;
  /** Generate using native tool-use / function calling. */
  generateWithTools?(
    userPrompt: string,
    systemPrompt: string,
    tools: ToolDefinition[],
  ): Promise<ToolCallResult>;
}
