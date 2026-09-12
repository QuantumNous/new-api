import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const mode = process.env.MODE ?? 'prod'
const isDev = mode === 'dev'

const PORT = await getTestServerPort(`${packageJson.name}-${mode}`)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['line']],
  use: { baseURL },
  webServer: {
    command: isDev ? 'pnpm dev:e2e' : 'pnpm build && pnpm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
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
