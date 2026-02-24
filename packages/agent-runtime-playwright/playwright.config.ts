import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
  },
  webServer: {
    command: 'npx vite --port 5174 --config ../../samples/billing-app/vite.config.ts ../../samples/billing-app',
    port: 5174,
    reuseExistingServer: true,
  },
});
