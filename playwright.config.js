import { defineConfig } from '@playwright/test';

const isHeaded = process.env.HEADED === 'true';
const isVerbose = process.env.VERBOSE === 'true';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: !isHeaded,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  quiet: !isVerbose,
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'tablet',
      testMatch: /responsive-(layout|realdata)\.test\.js$/,
      use: {
        viewport: { width: 1024, height: 1366 },
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: 'smartphone',
      testMatch: /responsive-(layout|realdata)\.test\.js$/,
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
