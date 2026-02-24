import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        invoicesNew: resolve(__dirname, 'invoices/new/index.html'),
        invoices: resolve(__dirname, 'invoices/index.html'),
        settings: resolve(__dirname, 'settings/index.html'),
      },
    },
  },
});
