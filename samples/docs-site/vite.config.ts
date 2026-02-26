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
        attributes: resolve(__dirname, 'attributes/index.html'),
        manifest: resolve(__dirname, 'manifest/index.html'),
        execution: resolve(__dirname, 'execution/index.html'),
        tooling: resolve(__dirname, 'tooling/index.html'),
        examples: resolve(__dirname, 'examples/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '/aaf-agent.js': resolve(__dirname, '../../packages/aaf-agent-widget/src/widget.ts'),
    },
  },
});
