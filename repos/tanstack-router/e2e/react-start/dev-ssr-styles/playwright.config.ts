import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }
import { ssrStylesMode, useNitro, viteBundledDev } from './env'

const mode = process.env.MODE ?? 'prod'
const isDev = mode === 'dev'

// Build a unique port key per dimension combination (ssrStyles mode + nitro)
// e.g. "...dev-ssr-styles", "...dev-ssr-styles-disabled", "...dev-ssr-styles-nitro",
//      "...dev-ssr-styles-disabled-nitro"
function getPortKey() {
  let key = packageJson.name
  if (ssrStylesMode !== 'default') {
    key += `-${ssrStylesMode}`
  }
  if (useNitro) {
    key += '-nitro'
  }
  if (viteBundledDev) {
    key += '-bundled-dev'
  }
  return key
}

const PORT = await getTestServerPort(getPortKey())
const baseURL = `http://localhost:${PORT}`

// Select the appropriate dev command based on SSR_STYLES + VITE_USE_NITRO
function getDevCommand() {
  const scriptParts = ['dev:e2e']
  if (ssrStylesMode !== 'default') {
    scriptParts.push(ssrStylesMode)
  }
  if (useNitro) {
    scriptParts.push('nitro')
  }
  return `pnpm ${scriptParts.join(':')}`
}

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
    command: isDev ? getDevCommand() : `pnpm build && PORT=${PORT} pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      VITE_NODE_ENV: 'test',
      PORT: String(PORT),
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
