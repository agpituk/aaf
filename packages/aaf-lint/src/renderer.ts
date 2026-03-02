export interface RenderOptions {
  /** Additional CSS selectors of elements to remove before HTML extraction. */
  excludeSelectors?: string[];
  /**
   * Auto-detect and remove common development tools (TanStack Router/Query
   * DevTools, Next.js build indicators, etc.) from the rendered DOM.
   * Defaults to `true`.
   */
  stripDevTools?: boolean;
}

/**
 * CSS selectors for well-known development tool containers.
 * These are tried first; any that don't match are silently skipped.
 */
const DEV_TOOLS_SELECTORS = [
  // AAF ignore marker — sites can opt elements out of scoring
  '[data-agent-ignore]',
  // TanStack Router DevTools
  '.tsrd-open-btn-container',
  '[class*="TanStackRouterDevtools"]',
  '#TanStackRouterDevtools',
  // TanStack Query DevTools
  '.tsqd-parent-container',
  '[class*="ReactQueryDevtools"]',
  '#ReactQueryDevtools',
  // Next.js
  'nextjs-portal',
  '#__next-build-indicator',
  '[data-nextjs-dialog]',
  // Vite / webpack error overlays
  'vite-error-overlay',
  '[data-vite-dev-id]',
  '#webpack-dev-server-client-overlay',
  // Cookie consent banners (common libraries)
  '[class*="CookieConsent"]',
  '[id*="CookieConsent"]',
  '[class*="cookie-consent"]',
  '[id*="cookie-consent"]',
  '[class*="cookieconsent"]',
  '[data-nosnippet="true"][class*="cookie"]',
  '#onetrust-consent-sdk',
  '#CybotCookiebotDialog',
];

/**
 * Text markers found in development tool overlays.
 * Any `position: fixed` container whose `textContent` includes one of these
 * strings is removed from the DOM before HTML extraction.
 */
const DEV_TOOLS_TEXT_MARKERS = [
  'TanStack Router',
  'TanStack Query',
  'React Query Devtools',
  'Accept All cookies',
  'Reject All cookies',
  'cookie preferences',
  'Hide Error',
  'Show Error',
];

export async function renderURL(url: string, options?: RenderOptions): Promise<string> {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error(
      'playwright is required for --render. Install it with: npm install playwright'
    );
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // Strip dev tools and user-specified elements from the DOM
    const stripDevTools = options?.stripDevTools !== false;
    const extraSelectors = options?.excludeSelectors ?? [];

    if (stripDevTools || extraSelectors.length > 0) {
      const selectors = [
        ...(stripDevTools ? DEV_TOOLS_SELECTORS : []),
        ...extraSelectors,
      ];
      const textMarkers = stripDevTools ? DEV_TOOLS_TEXT_MARKERS : [];

      await page.evaluate(({ selectors, textMarkers }) => {
        // Phase 1: Remove elements matching known CSS selectors
        for (const sel of selectors) {
          try {
            document.querySelectorAll(sel).forEach((el) => el.remove());
          } catch {
            /* ignore invalid selectors */
          }
        }

        // Phase 2: Remove position:fixed containers whose text matches
        // dev-tool markers (catches CSS-in-JS / obfuscated class names)
        if (textMarkers.length > 0) {
          const candidates = document.querySelectorAll('aside, div, section, nav');
          for (const el of candidates) {
            if (!(el instanceof HTMLElement)) continue;
            const style = window.getComputedStyle(el);
            if (style.position !== 'fixed') continue;
            const text = el.textContent ?? '';
            if (textMarkers.some((marker) => text.includes(marker))) {
              el.remove();
            }
          }
        }

        // Phase 3: Remove framework error boundaries (TanStack Router ErrorComponent, etc.)
        // These render inline (not position:fixed) and contain "Something went wrong!" + error toggle buttons
        const errorCandidates = document.querySelectorAll('div');
        for (const el of errorCandidates) {
          if (!(el instanceof HTMLElement)) continue;
          const text = el.textContent ?? '';
          if (text.includes('Something went wrong!') && (text.includes('Hide Error') || text.includes('Show Error'))) {
            el.remove();
            break; // Only remove the outermost match
          }
        }
      }, { selectors, textMarkers });
    }

    const html = await page.evaluate(() => document.documentElement.outerHTML);
    return html;
  } finally {
    await browser.close();
  }
}
