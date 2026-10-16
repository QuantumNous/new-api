import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const distDir = process.env.E2E_DIST_DIR ?? `dist-${toolchain}-ssr`
const e2ePortKey =
  process.env.E2E_PORT_KEY ?? `${packageJson.name}-${toolchain}`
const serverEntryFile = toolchain === 'rsbuild' ? 'index.js' : 'server.js'
const startCommand = `pnpm exec srvx --prod --dir=. -s ${distDir}/client --entry ${distDir}/server/${serverEntryFile}`

if (process.env.TEST_WORKER_INDEX === undefined) {
  fs.rmSync(`port-${e2ePortKey}.txt`, { force: true })
}

const PORT = await getTestServerPort(e2ePortKey)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['line']],
  use: { baseURL },
  webServer: {
    command: startCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      E2E_DIST_DIR: distDir,
      NODE_ENV: 'production',
      PORT: String(PORT),
      VITE_SERVER_PORT: String(PORT),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
