import type { Plugin } from 'vite';
import { scanHtml, generateManifest } from './html-scanner.js';

export interface AAFVitePluginOptions {
  /** Site name for the manifest */
  siteName?: string;
  /** Site origin for the manifest */
  origin?: string;
  /** LLM-friendly description of the site's capabilities */
  siteDescription?: string;
}

export function aafPlugin(options: AAFVitePluginOptions = {}): Plugin {
  const htmlFiles: Map<string, string> = new Map();

  return {
    name: 'aaf-manifest-generator',

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const fileName = ctx.filename || 'index.html';
        htmlFiles.set(fileName, html);
      },
    },

    generateBundle(_, bundle) {
      // Collect HTML from bundle
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.html') && asset.type === 'asset' && typeof asset.source === 'string') {
          htmlFiles.set(fileName, asset.source);
        }
      }

      // Scan all HTML files and build page map
      const allActions = [];
      const pageMap: Record<string, string[]> = {};
      for (const [fileName, html] of htmlFiles.entries()) {
        const scanned = scanHtml(html);
        allActions.push(...scanned);
        if (scanned.length > 0) {
          const route = '/' + fileName.replace(/index\.html$/, '').replace(/\.html$/, '');
          pageMap[route] = scanned.map(a => a.action);
        }
      }

      if (allActions.length === 0) return;

      // Deduplicate by action name
      const uniqueActions = new Map();
      for (const action of allActions) {
        if (!uniqueActions.has(action.action)) {
          uniqueActions.set(action.action, action);
        }
      }

      const site: { name: string; origin: string; description?: string } = {
        name: options.siteName || 'My Site',
        origin: options.origin || 'http://localhost:5173',
      };
      if (options.siteDescription) {
        site.description = options.siteDescription;
      }

      const manifest = generateManifest(
        Array.from(uniqueActions.values()),
        site,
        pageMap,
      );

      this.emitFile({
        type: 'asset',
        fileName: '.well-known/agent-manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
