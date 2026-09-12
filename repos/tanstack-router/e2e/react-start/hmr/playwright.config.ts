import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const e2ePortKey =
  process.env.E2E_PORT_KEY ?? `${packageJson.name}-${toolchain}`
const distDir = process.env.E2E_DIST_DIR ?? 'dist'
const viteBundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'
const PORT = await getTestServerPort(e2ePortKey)
const baseURL = `http://localhost:${PORT}`
const devCommand =
  toolchain === 'rsbuild' ? 'pnpm dev:rsbuild' : 'pnpm dev:vite'

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
    command: `${devCommand} --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      VITE_NODE_ENV: 'test',
      PORT: String(PORT),
      E2E_TOOLCHAIN: toolchain,
      E2E_DIST_DIR: distDir,
      E2E_PORT_KEY: e2ePortKey,
      E2E_VITE_BUNDLED_DEV: String(viteBundledDev),
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
