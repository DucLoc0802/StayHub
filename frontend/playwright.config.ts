import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
});
