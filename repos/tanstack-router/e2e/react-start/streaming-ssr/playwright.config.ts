import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const isPreview = process.env.MODE === 'preview'

const PORT = await getTestServerPort(
  `${packageJson.name}${isPreview ? '_preview' : ''}`,
)
const baseURL = `http://localhost:${PORT}`

const ssrCommand = `VITE_SERVER_PORT=${PORT} pnpm build && PORT=${PORT} VITE_SERVER_PORT=${PORT} pnpm start`
const previewCommand = `VITE_SERVER_PORT=${PORT} pnpm build && pnpm preview --port ${PORT}`

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,

  reporter: [['line']],

  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
  },

  webServer: {
    command: isPreview ? previewCommand : ssrCommand,
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
