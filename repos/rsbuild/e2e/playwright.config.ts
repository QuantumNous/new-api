import { defineConfig } from '@playwright/test';

// https://playwright.dev/docs/service-workers-experimental
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  // Retry on CI
  retries: isCI ? 3 : 0,
  // Print line for each test being run in CI
  reporter: 'list',
  use: {
    // Use the built-in Chrome browser to speed up CI tests
    channel: isCI ? 'chrome' : undefined,
  },
});
