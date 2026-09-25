import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const PORT = await getTestServerPort(packageJson.name)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL,
  },
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT}`,
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
