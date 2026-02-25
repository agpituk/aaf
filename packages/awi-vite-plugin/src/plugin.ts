import type { Plugin } from 'vite';
import { scanHtml, generateManifest } from './html-scanner.js';

export interface AWIVitePluginOptions {
  /** Site name for the manifest */
  siteName?: string;
  /** Site origin for the manifest */
  origin?: string;
}

export function awiPlugin(options: AWIVitePluginOptions = {}): Plugin {
  const htmlFiles: Map<string, string> = new Map();

  return {
    name: 'awi-manifest-generator',

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

      // Scan all HTML files
      const allActions = [];
      for (const html of htmlFiles.values()) {
        allActions.push(...scanHtml(html));
      }

      if (allActions.length === 0) return;

      // Deduplicate by action name
      const uniqueActions = new Map();
      for (const action of allActions) {
        if (!uniqueActions.has(action.action)) {
          uniqueActions.set(action.action, action);
        }
      }

      const manifest = generateManifest(
        Array.from(uniqueActions.values()),
        {
          name: options.siteName || 'My Site',
          origin: options.origin || 'http://localhost:5173',
        },
      );

      this.emitFile({
        type: 'asset',
        fileName: '.well-known/agent-manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
