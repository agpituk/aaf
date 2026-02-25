import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { existsSync } from 'fs';

/** Redirect /path to /path/ when /path/index.html exists (standard MPA behavior). */
function trailingSlash(): Plugin {
  return {
    name: 'trailing-slash',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0];
        if (url && !url.endsWith('/') && !url.includes('.')) {
          const candidate = resolve(__dirname, '.' + url, 'index.html');
          if (existsSync(candidate)) {
            req.url = url + '/';
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [trailingSlash()],
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
  resolve: {
    alias: {
      '/awi-agent.js': resolve(__dirname, '../../packages/awi-agent-widget/src/widget.ts'),
    },
  },
});
