import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import { isErrorMode } from './tests/utils/isErrorMode'
import packageJson from './package.json' with { type: 'json' }

const PORT = await getTestServerPort(packageJson.name)
const baseURL = `http://localhost:${PORT}`

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

  ...(isErrorMode
    ? {}
    : {
        webServer: {
          command: `rm -f webserver-build.log violations.build.json violations.dev.json && VITE_SERVER_PORT=${PORT} pnpm build > webserver-build.log 2>&1 && PORT=${PORT} VITE_SERVER_PORT=${PORT} pnpm start`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          cwd: import.meta.dirname,
        },
      }),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: isErrorMode ? 'error-mode.spec.ts' : 'custom-config.spec.ts',
    },
  ],
})
