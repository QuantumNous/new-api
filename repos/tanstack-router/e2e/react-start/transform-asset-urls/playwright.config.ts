import { defineConfig, devices } from '@playwright/test'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from './package.json' with { type: 'json' }

const APP_PORT = await getTestServerPort(packageJson.name)
const CDN_PORT = await getTestServerPort(`${packageJson.name}_cdn`)

const baseURL = `http://localhost:${APP_PORT}`
const cdnOrigin = `http://localhost:${CDN_PORT}`
const transformMode = process.env.TRANSFORM_ASSETS_MODE || 'string'
const optionsKind =
  process.env.TRANSFORM_ASSETS_OPTIONS_KIND || 'createTransform'
const optionsCache = process.env.TRANSFORM_ASSETS_OPTIONS_CACHE || 'true'
const optionsWarmup = process.env.TRANSFORM_ASSETS_OPTIONS_WARMUP || 'true'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: [['line']],

  use: {
    baseURL,
  },

  webServer: [
    {
      // CDN server — serves built client assets on a separate port with CORS
      command: `node tests/cdn-server.mjs`,
      url: `http://localhost:${CDN_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      env: {
        CDN_PORT: String(CDN_PORT),
      },
    },
    {
      // App server — builds the project then starts the srvx server
      // with CDN_ORIGIN so that transformAssets rewrites manifest URLs
      command: `pnpm build && pnpm start`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      env: {
        PORT: String(APP_PORT),
        CDN_ORIGIN: cdnOrigin,
        TRANSFORM_ASSETS_MODE: transformMode,
        TRANSFORM_ASSETS_OPTIONS_KIND: optionsKind,
        TRANSFORM_ASSETS_OPTIONS_CACHE: optionsCache,
        TRANSFORM_ASSETS_OPTIONS_WARMUP: optionsWarmup,
      },
      timeout: 120_000,
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
