import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetPlanner, PlannerError } from './widget-planner.js';
import type { LlmBackend } from '@agent-accessibility-framework/planner-local';
import type { ActionCatalog } from '@agent-accessibility-framework/runtime-core';

const CATALOG: ActionCatalog = {
  actions: [],
  url: 'http://localhost:5173/dashboard',
  timestamp: '2024-01-01T00:00:00.000Z',
};

function createMockBackend(): LlmBackend & { generate: ReturnType<typeof vi.fn> } {
  return {
    generate: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    name: () => 'mock',
  };
}

describe('WidgetPlanner', () => {
  let backend: ReturnType<typeof createMockBackend>;
  let planner: WidgetPlanner;

  beforeEach(() => {
    backend = createMockBackend();
    planner = new WidgetPlanner(backend);
  });

  it('includes CORRECTION context in planSiteAware retry after route validation failure', async () => {
    // First call: LLM returns "/" which is not in valid routes → validation error
    // Second call: LLM returns "/dashboard" which is valid → success
    backend.generate
      .mockResolvedValueOnce('{"navigate": "/"}')
      .mockResolvedValue('{"navigate": "/dashboard"}');

    const pages = [{ route: '/dashboard', title: 'Dashboard' }];
    const { result } = await planner.planSiteAware('go to the dashboard', CATALOG, [], pages);

    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/dashboard');
    expect(backend.generate).toHaveBeenCalledTimes(2);

    const [retryPrompt] = backend.generate.mock.calls[1];
    expect(retryPrompt).toContain('CORRECTION:');
    expect(retryPrompt).toContain('Invalid navigation route');
    expect(retryPrompt).toContain('go to the dashboard');
  });

  it('returns debug metadata with system prompt, user prompt, raw response, and timing', async () => {
    const rawJson = '{"action": "none", "answer": "Hello there"}';
    backend.generate.mockResolvedValue(rawJson);

    const { result, debug } = await planner.plan('say hello', CATALOG);

    expect(result.kind).toBe('answer');
    expect(debug.systemPrompt).toBeTruthy();
    expect(debug.userPrompt).toContain('say hello');
    expect(debug.rawResponse).toBe(rawJson);
    expect(debug.attempts).toBe(1);
    expect(debug.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports correct attempt count on retry', async () => {
    // First call fails with a retryable parse error, second succeeds
    backend.generate
      .mockResolvedValueOnce('not valid json at all')
      .mockResolvedValue('{"action": "none", "answer": "ok"}');

    const { result, debug } = await planner.plan('test retry', CATALOG);

    expect(result.kind).toBe('answer');
    expect(debug.attempts).toBe(2);
    expect(backend.generate).toHaveBeenCalledTimes(2);
  });

  it('throws PlannerError with debug info when all retries fail', async () => {
    backend.generate.mockResolvedValue('totally invalid json garbage');

    try {
      await planner.plan('will fail', CATALOG);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PlannerError);
      const plannerErr = err as PlannerError;
      expect(plannerErr.debug.systemPrompt).toBeTruthy();
      expect(plannerErr.debug.rawResponse).toBe('totally invalid json garbage');
      expect(plannerErr.debug.attempts).toBe(5);
      expect(plannerErr.debug.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
