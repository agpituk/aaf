import { defineConfig } from 'vite';
import { resolve } from 'path';

const sharedResolve = {
  alias: {
    '@agent-native-web/runtime-core': resolve(__dirname, '../agent-runtime-core/src/index.ts'),
    '@agent-native-web/awi-contracts': resolve(__dirname, '../awi-contracts/src/index.ts'),
    '@agent-native-web/planner-local': resolve(__dirname, '../awi-planner-local/src/index.ts'),
  },
};

// Default config used by `vite build` — builds the background script as ES module.
// The build.mjs script uses per-entry IIFE builds for sidebar + content scripts.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
        'harbor-page-script': resolve(__dirname, 'src/content/harbor-page-script.ts'),
        background: resolve(__dirname, 'src/background/background.ts'),
        sidebar: resolve(__dirname, 'src/sidebar/sidebar.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
        format: 'es',
      },
    },
  },
  resolve: sharedResolve,
});
