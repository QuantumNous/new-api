import { devices, type PlaywrightTestConfig } from '@playwright/test';
const PORT = process.env.PORT || 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: './tests/e2e/spec',
  snapshotPathTemplate: './tests/e2e/__snapshots__/{testFilePath}/{arg}{ext}',
  timeout: 20_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 3,
  retries: 2,
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'test-results.json' }]]
    : 'list',
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    userAgent: 'playwright-test bot',
  },
  webServer: {
    cwd: './tests/e2e/next-server',
    command: 'pnpm run dev',
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
};

export default config;
