import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetPlanner } from './widget-planner.js';
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
    const result = await planner.planSiteAware('go to the dashboard', CATALOG, [], pages);

    expect(result.kind).toBe('navigate');
    if (result.kind !== 'navigate') throw new Error('unexpected');
    expect(result.page).toBe('/dashboard');
    expect(backend.generate).toHaveBeenCalledTimes(2);

    const [retryPrompt] = backend.generate.mock.calls[1];
    expect(retryPrompt).toContain('CORRECTION:');
    expect(retryPrompt).toContain('Invalid navigation route');
    expect(retryPrompt).toContain('go to the dashboard');
  });
});
