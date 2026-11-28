import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const mode = process.env.MODE ?? 'prod'
const isDev = mode === 'dev'
const viteConfig = process.env.VITE_CONFIG // 'nitro' | 'basepath' | 'cloudflare' | undefined
const PORT = await getTestServerPort(
  viteConfig ? `${packageJson.name}-${viteConfig}` : packageJson.name,
)

// When using basepath config, the app is served at /my-app
const basePath = viteConfig === 'basepath' ? '/my-app' : ''
const baseURL = `http://localhost:${PORT}${basePath}`

// Select the appropriate dev command based on VITE_CONFIG
const devCommand = viteConfig ? `pnpm dev:e2e:${viteConfig}` : 'pnpm dev:e2e'

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
    command: isDev ? devCommand : `pnpm build && PORT=${PORT} pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      VITE_NODE_ENV: 'test',
      PORT: String(PORT),
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
