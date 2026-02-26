import { describe, it, expect } from 'vitest';
import { aafPlugin } from './plugin.js';

describe('aafPlugin', () => {
  it('returns a plugin with correct name', () => {
    const plugin = aafPlugin();
    expect(plugin.name).toBe('aaf-manifest-generator');
  });

  it('has transformIndexHtml and generateBundle hooks', () => {
    const plugin = aafPlugin();
    expect(plugin.transformIndexHtml).toBeDefined();
    expect(plugin.generateBundle).toBeDefined();
  });

  it('accepts options', () => {
    const plugin = aafPlugin({ siteName: 'My App', origin: 'https://example.com' });
    expect(plugin.name).toBe('aaf-manifest-generator');
  });

  it('accepts siteDescription option', () => {
    const plugin = aafPlugin({ siteName: 'My App', origin: 'https://example.com', siteDescription: 'A test app' });
    expect(plugin.name).toBe('aaf-manifest-generator');
  });
});
