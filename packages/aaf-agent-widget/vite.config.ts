import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/widget.ts'),
      name: 'AAFAgent',
      formats: ['iife'],
      fileName: () => 'aaf-agent.js',
    },
    outDir: 'dist',
    rollupOptions: {
      // Bundle everything — no externals
      external: [],
    },
  },
  resolve: {
    alias: {
      '@agent-accessibility-framework/runtime-core': resolve(__dirname, '../agent-runtime-core/src/index.ts'),
      '@agent-accessibility-framework/contracts': resolve(__dirname, '../aaf-contracts/src/index.ts'),
      '@agent-accessibility-framework/planner-local': resolve(__dirname, '../aaf-planner-local/src/index.ts'),
    },
  },
});
