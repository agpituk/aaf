import { describe, it, expect } from 'vitest';
import { checkLlmsTxt } from './llms-txt-checker.js';

describe('checkLlmsTxt', () => {
  it('reports errors when llms.txt is not found', async () => {
    // This will fail since no server is running
    const result = await checkLlmsTxt('http://localhost:99999');
    expect(result.exists).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
