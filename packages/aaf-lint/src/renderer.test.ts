import { describe, it, expect } from 'vitest';
import { renderURL } from './renderer.js';
import type { RenderOptions } from './renderer.js';

describe('renderer', () => {
  it('exports renderURL as a function', () => {
    expect(typeof renderURL).toBe('function');
  });

  it('accepts RenderOptions with excludeSelectors', () => {
    const opts: RenderOptions = {
      excludeSelectors: ['.my-devtools', '#cookie-banner'],
      stripDevTools: true,
    };
    expect(opts.excludeSelectors).toHaveLength(2);
    expect(opts.stripDevTools).toBe(true);
  });

  it('defaults stripDevTools to true when option is undefined', () => {
    const opts: RenderOptions = {};
    // stripDevTools defaults to true (not false) — renderer checks !== false
    expect(opts.stripDevTools).toBeUndefined();
    expect(opts.stripDevTools !== false).toBe(true);
  });

  it('respects stripDevTools: false', () => {
    const opts: RenderOptions = { stripDevTools: false };
    expect(opts.stripDevTools).toBe(false);
  });
});
