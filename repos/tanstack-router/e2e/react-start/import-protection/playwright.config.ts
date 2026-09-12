import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import { isErrorMode } from './tests/utils/isErrorMode'
import packageJson from './package.json' with { type: 'json' }

const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const viteBundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'
const e2ePortKey =
  process.env.E2E_PORT_KEY ??
  `${packageJson.name}-${toolchain}${viteBundledDev ? '-bundled-dev' : ''}`
const distDir = process.env.E2E_DIST_DIR ?? 'dist'
const PORT = await getTestServerPort(e2ePortKey)
const baseURL = `http://localhost:${PORT}`
const buildCommand =
  toolchain === 'rsbuild' ? 'pnpm build:rsbuild' : 'pnpm build:vite'

console.log('running in error mode:', isErrorMode.toString())

export default defineConfig({
  testDir: './tests',
  workers: 1,

  globalSetup: isErrorMode
    ? './tests/error-mode.setup.ts'
    : './tests/violations.setup.ts',

  reporter: [['line']],

  use: {
    baseURL,
  },

  // In error mode the build intentionally fails, so there is no server to
  // start.  We skip the webServer entirely and only run error-mode.spec.ts.
  ...(isErrorMode
    ? {}
    : {
        webServer: {
          command: `rm -f webserver-build.log webserver-dev.log violations.build.json violations.dev.json && VITE_SERVER_PORT=${PORT} PORT=${PORT} ${buildCommand} > webserver-build.log 2>&1 && PORT=${PORT} VITE_SERVER_PORT=${PORT} pnpm start`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          cwd: import.meta.dirname,
          env: {
            PORT: String(PORT),
            VITE_SERVER_PORT: String(PORT),
            E2E_DIST_DIR: distDir,
            E2E_PORT_KEY: e2ePortKey,
            E2E_VITE_BUNDLED_DEV: String(viteBundledDev),
          },
        },
      }),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: isErrorMode
        ? 'error-mode.spec.ts'
        : 'import-protection.spec.ts',
    },
  ],
})
