import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/widget.ts'),
      name: 'AWIAgent',
      formats: ['iife'],
      fileName: () => 'awi-agent.js',
    },
    outDir: 'dist',
    rollupOptions: {
      // Bundle everything — no externals
      external: [],
    },
  },
  resolve: {
    alias: {
      '@agent-native-web/runtime-core': resolve(__dirname, '../agent-runtime-core/src/index.ts'),
      '@agent-native-web/awi-contracts': resolve(__dirname, '../awi-contracts/src/index.ts'),
      '@agent-native-web/planner-local': resolve(__dirname, '../awi-planner-local/src/index.ts'),
    },
  },
});
