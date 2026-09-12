import { defineConfig, devices } from '@playwright/test'
import {
  getDummyServerPort,
  getTestServerPort,
} from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const PORT = await getTestServerPort(packageJson.name)
const EXTERNAL_PORT = await getDummyServerPort(packageJson.name)
const baseURL = `http://localhost:${PORT}`
const command = `pnpm build && pnpm preview --port ${PORT}`

console.info('Running with mode: ', process.env.MODE || 'default')

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
    command,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      MODE: process.env.MODE || '',
      VITE_MODE: process.env.MODE || '',
      VITE_NODE_ENV: 'test',
      VITE_EXTERNAL_PORT: String(EXTERNAL_PORT),
      VITE_SERVER_PORT: String(PORT),
      PORT: String(PORT),
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
