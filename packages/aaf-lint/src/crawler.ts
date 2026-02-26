export interface CrawlResult {
  url: string;
  html: string;
}

/**
 * Extract same-origin <a href> links from HTML.
 * Resolves relative URLs against the origin, strips hash fragments, deduplicates.
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*"([^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
      continue;
    }

    try {
      const resolved = new URL(href, baseUrl);
      // Same-origin only
      if (resolved.origin !== origin) continue;
      // Strip hash fragment
      resolved.hash = '';
      const normalized = resolved.href;
      seen.add(normalized);
    } catch {
      // Skip malformed URLs
    }
  }

  // Remove the base URL itself from the link set
  const baseNormalized = new URL(baseUrl).href;
  seen.delete(baseNormalized);
  // Also remove without trailing slash variant
  if (baseNormalized.endsWith('/')) {
    seen.delete(baseNormalized.slice(0, -1));
  } else {
    seen.delete(baseNormalized + '/');
  }

  return [...seen].sort();
}

/**
 * Single-depth crawl: fetch entry page, extract same-origin links, fetch each.
 * Returns all pages (entry + linked).
 */
export async function crawlSite(
  entryUrl: string,
  fetchPage: (url: string) => Promise<string>,
): Promise<CrawlResult[]> {
  const entryHtml = await fetchPage(entryUrl);
  const results: CrawlResult[] = [{ url: entryUrl, html: entryHtml }];

  const links = extractLinks(entryHtml, entryUrl);
  const fetches = links.map(async (url) => {
    try {
      const html = await fetchPage(url);
      return { url, html };
    } catch {
      // Skip pages that fail to load
      return null;
    }
  });

  const linked = await Promise.all(fetches);
  for (const result of linked) {
    if (result) results.push(result);
  }

  return results;
}
