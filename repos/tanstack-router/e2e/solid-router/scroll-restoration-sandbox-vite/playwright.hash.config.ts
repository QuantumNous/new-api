import { defineConfig, devices } from '@playwright/test'
import {
  getDummyServerPort,
  getTestServerPort,
  resolveRuntimeSuffix,
} from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const PORT = await getTestServerPort(
  packageJson.name + `-${resolveRuntimeSuffix('hash')}`,
)
const EXTERNAL_PORT = await getDummyServerPort(packageJson.name)
const baseURL = `http://localhost:${PORT}`
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,

  reporter: [['line']],

  globalSetup: './tests/setup/global.setup.ts',
  globalTeardown: './tests/setup/global.teardown.ts',

  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
  },

  webServer: {
    command: `VITE_NODE_ENV="test" VITE_EXTERNAL_PORT=${EXTERNAL_PORT} VITE_SERVER_PORT=${PORT} VITE_APP_HISTORY=hash vite build --outDir dist-hash && VITE_NODE_ENV="test" VITE_EXTERNAL_PORT=${EXTERNAL_PORT} VITE_SERVER_PORT=${PORT} VITE_APP_HISTORY=hash pnpm preview --port ${PORT} --outDir dist-hash`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
