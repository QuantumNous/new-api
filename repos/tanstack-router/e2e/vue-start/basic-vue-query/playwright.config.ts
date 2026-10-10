import { defineConfig, devices } from '@playwright/test'
import {
  getDummyServerPort,
  getTestServerPort,
} from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const PORT = await getTestServerPort(packageJson.name)
const EXTERNAL_PORT = await getDummyServerPort(packageJson.name)

const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  workers: 1,

  reporter: [['line']],

  globalSetup: './tests/setup/global.setup.ts',
  globalTeardown: './tests/setup/global.teardown.ts',

  use: {
    baseURL,
  },

  webServer: {
    command: `VITE_NODE_ENV="test" VITE_EXTERNAL_PORT=${EXTERNAL_PORT} VITE_SERVER_PORT=${PORT} pnpm build && VITE_NODE_ENV="test" VITE_EXTERNAL_PORT=${EXTERNAL_PORT} PORT=${PORT} VITE_SERVER_PORT=${PORT} pnpm start`,
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
