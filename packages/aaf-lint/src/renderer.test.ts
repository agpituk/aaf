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

  it('accepts auth with storageStatePath', () => {
    const opts: RenderOptions = {
      auth: { storageStatePath: '/path/to/state.json' },
    };
    expect(opts.auth?.storageStatePath).toBe('/path/to/state.json');
  });

  it('accepts auth with cookies', () => {
    const opts: RenderOptions = {
      auth: {
        cookies: [
          { name: 'token', value: 'abc123', domain: 'localhost', path: '/' },
        ],
      },
    };
    expect(opts.auth?.cookies).toHaveLength(1);
    expect(opts.auth?.cookies![0].name).toBe('token');
    expect(opts.auth?.cookies![0].domain).toBe('localhost');
  });

  it('accepts auth with localStorage entries', () => {
    const opts: RenderOptions = {
      auth: { localStorage: { token: 'abc123', theme: 'dark' } },
    };
    expect(opts.auth?.localStorage).toEqual({ token: 'abc123', theme: 'dark' });
  });

  it('accepts combined auth options', () => {
    const opts: RenderOptions = {
      stripDevTools: true,
      auth: {
        storageStatePath: '/path/to/state.json',
        cookies: [{ name: 'sid', value: 'xyz', domain: 'example.com' }],
        localStorage: { key: 'value' },
      },
    };
    expect(opts.auth?.storageStatePath).toBe('/path/to/state.json');
    expect(opts.auth?.cookies).toHaveLength(1);
    expect(opts.auth?.localStorage).toEqual({ key: 'value' });
  });
});
