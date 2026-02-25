import { describe, it, expect } from 'vitest';
import rule from './action-has-manifest.js';

describe('action-has-manifest', () => {
  it('exports a rule with correct meta', () => {
    expect(rule.meta?.type).toBe('problem');
    expect(rule.meta?.messages).toHaveProperty('unknownAction');
  });

  it('returns empty visitor when no manifestPath option', () => {
    const mockContext = {
      options: [],
      report: () => {},
    } as any;
    const visitor = rule.create(mockContext);
    expect(Object.keys(visitor)).toHaveLength(0);
  });

  it('returns empty visitor when manifest file does not exist', () => {
    const mockContext = {
      options: [{ manifestPath: '/nonexistent/path/manifest.json' }],
      report: () => {},
    } as any;
    const visitor = rule.create(mockContext);
    expect(Object.keys(visitor)).toHaveLength(0);
  });
});
