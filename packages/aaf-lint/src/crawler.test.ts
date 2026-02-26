import { describe, it, expect, vi } from 'vitest';
import { extractLinks, crawlSite } from './crawler.js';

describe('extractLinks', () => {
  const base = 'http://localhost:5178/';

  it('extracts same-origin links', () => {
    const html = `
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    `;
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/about',
      'http://localhost:5178/contact',
    ]);
  });

  it('filters out cross-origin links', () => {
    const html = `
      <a href="/local">Local</a>
      <a href="https://external.com/page">External</a>
    `;
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/local',
    ]);
  });

  it('resolves relative URLs against base', () => {
    const html = `<a href="sub/page">Page</a>`;
    expect(extractLinks(html, 'http://localhost:5178/docs/')).toEqual([
      'http://localhost:5178/docs/sub/page',
    ]);
  });

  it('strips hash fragments', () => {
    const html = `
      <a href="/page#section1">Link 1</a>
      <a href="/page#section2">Link 2</a>
    `;
    // Both resolve to /page after stripping hash — should deduplicate
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/page',
    ]);
  });

  it('deduplicates identical URLs', () => {
    const html = `
      <a href="/page">Link 1</a>
      <a href="/page">Link 2</a>
      <a href="/page">Link 3</a>
    `;
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/page',
    ]);
  });

  it('excludes the base URL itself', () => {
    const html = `
      <a href="/">Home</a>
      <a href="/about">About</a>
    `;
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/about',
    ]);
  });

  it('skips mailto, javascript, and empty hrefs', () => {
    const html = `
      <a href="">Empty</a>
      <a href="#">Hash</a>
      <a href="mailto:test@test.com">Mail</a>
      <a href="javascript:void(0)">JS</a>
      <a href="/real">Real</a>
    `;
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/real',
    ]);
  });

  it('handles single-quoted or unquoted hrefs gracefully (only matches double-quoted)', () => {
    const html = `
      <a href="/matched">Matched</a>
      <a href='/single'>Single</a>
    `;
    // Our regex only matches double-quoted hrefs
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/matched',
    ]);
  });

  it('returns sorted URLs', () => {
    const html = `
      <a href="/zebra">Z</a>
      <a href="/alpha">A</a>
      <a href="/middle">M</a>
    `;
    expect(extractLinks(html, base)).toEqual([
      'http://localhost:5178/alpha',
      'http://localhost:5178/middle',
      'http://localhost:5178/zebra',
    ]);
  });
});

describe('crawlSite', () => {
  it('fetches entry page and all linked pages', async () => {
    const pages: Record<string, string> = {
      'http://localhost:5178/': '<a href="/about">About</a><a href="/contact">Contact</a>',
      'http://localhost:5178/about': '<h1>About</h1>',
      'http://localhost:5178/contact': '<h1>Contact</h1>',
    };
    const fetchPage = vi.fn((url: string) => Promise.resolve(pages[url]));

    const results = await crawlSite('http://localhost:5178/', fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ url: 'http://localhost:5178/', html: pages['http://localhost:5178/'] });
    expect(results.map((r) => r.url).sort()).toEqual([
      'http://localhost:5178/',
      'http://localhost:5178/about',
      'http://localhost:5178/contact',
    ]);
  });

  it('includes entry page even if it has no links', async () => {
    const fetchPage = vi.fn(() => Promise.resolve('<h1>No links</h1>'));

    const results = await crawlSite('http://localhost:5178/', fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('http://localhost:5178/');
  });

  it('skips pages that fail to fetch', async () => {
    const pages: Record<string, string> = {
      'http://localhost:5178/': '<a href="/good">Good</a><a href="/bad">Bad</a>',
      'http://localhost:5178/good': '<h1>Good</h1>',
    };
    const fetchPage = vi.fn((url: string) => {
      if (pages[url]) return Promise.resolve(pages[url]);
      return Promise.reject(new Error('404'));
    });

    const results = await crawlSite('http://localhost:5178/', fetchPage);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.url).sort()).toEqual([
      'http://localhost:5178/',
      'http://localhost:5178/good',
    ]);
  });
});
