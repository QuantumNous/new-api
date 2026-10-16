import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import {
  getDummyServerPort,
  getTestServerPort,
} from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const mode = process.env.MODE ?? 'ssr'
const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const e2ePortKey = process.env.E2E_PORT_KEY ?? packageJson.name
const distDir = process.env.E2E_DIST_DIR ?? 'dist'

if (process.env.TEST_WORKER_INDEX === undefined) {
  for (const portFile of [
    `port-${e2ePortKey}.txt`,
    `port-${e2ePortKey}_start.txt`,
    `port-${e2ePortKey}-external.txt`,
  ]) {
    fs.rmSync(portFile, { force: true })
  }
}

const PORT = await getTestServerPort(e2ePortKey)
const START_PORT = await getTestServerPort(`${e2ePortKey}_start`)
const EXTERNAL_PORT = await getDummyServerPort(e2ePortKey)
const baseURL = `http://localhost:${PORT}`
const previewCommand =
  toolchain === 'rsbuild'
    ? `pnpm preview:rsbuild --port ${PORT}`
    : `pnpm preview --outDir ${distDir} --port ${PORT}`
const commandByMode =
  mode === 'preview'
    ? `pnpm run test:e2e:startDummyServer && ${previewCommand}`
    : `pnpm run test:e2e:startDummyServer && pnpm start`
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['line']],

  globalTeardown: './tests/setup/global.teardown.ts',

  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
  },

  webServer: {
    command: commandByMode,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      MODE: mode,
      E2E_TOOLCHAIN: toolchain,
      VITE_NODE_ENV: 'test',
      VITE_EXTERNAL_PORT: String(EXTERNAL_PORT),
      VITE_SERVER_PORT: String(PORT),
      START_PORT: String(START_PORT),
      PORT: String(PORT),
      E2E_DIST_DIR: distDir,
      E2E_PORT_KEY: e2ePortKey,
      ...(process.env.TSS_RSB_CLIENT_OUTPUT
        ? { TSS_RSB_CLIENT_OUTPUT: process.env.TSS_RSB_CLIENT_OUTPUT }
        : {}),
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
