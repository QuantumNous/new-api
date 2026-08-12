import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const toolchain = process.env.E2E_TOOLCHAIN ?? 'vite'
const inlineCssTransformAssets =
  process.env.CSS_INLINE_TRANSFORM_ASSETS || 'false'
if (!['true', 'false'].includes(inlineCssTransformAssets)) {
  throw new Error(
    `CSS_INLINE_TRANSFORM_ASSETS must be "true" or "false". Received: ${JSON.stringify(inlineCssTransformAssets)}`,
  )
}

const isInlineCssTransformAssets = inlineCssTransformAssets === 'true'
const transformAssetsSuffix = isInlineCssTransformAssets
  ? '-transform-assets'
  : ''
const distDir =
  process.env.E2E_DIST_DIR ?? `dist-${toolchain}${transformAssetsSuffix}-ssr`
const e2ePortKey =
  process.env.E2E_PORT_KEY ??
  `${packageJson.name}-${toolchain}${transformAssetsSuffix}`

if (process.env.TEST_WORKER_INDEX === undefined) {
  fs.rmSync(`port-${e2ePortKey}.txt`, { force: true })
}

const PORT = await getTestServerPort(e2ePortKey)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['line']],

  use: {
    baseURL,
  },

  webServer: {
    command: `pnpm build:${toolchain} && pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    env: {
      E2E_DIST_DIR: distDir,
      PORT: String(PORT),
      CSS_INLINE_TRANSFORM_ASSETS: inlineCssTransformAssets,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
