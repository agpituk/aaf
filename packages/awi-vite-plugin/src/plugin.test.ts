import { describe, it, expect } from 'vitest';
import { awiPlugin } from './plugin.js';

describe('awiPlugin', () => {
  it('returns a plugin with correct name', () => {
    const plugin = awiPlugin();
    expect(plugin.name).toBe('awi-manifest-generator');
  });

  it('has transformIndexHtml and generateBundle hooks', () => {
    const plugin = awiPlugin();
    expect(plugin.transformIndexHtml).toBeDefined();
    expect(plugin.generateBundle).toBeDefined();
  });

  it('accepts options', () => {
    const plugin = awiPlugin({ siteName: 'My App', origin: 'https://example.com' });
    expect(plugin.name).toBe('awi-manifest-generator');
  });
});
