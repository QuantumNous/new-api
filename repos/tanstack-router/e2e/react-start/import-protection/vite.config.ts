import path from 'node:path'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { getStartModeConfig } from './start-mode-config'

const outDir = process.env.E2E_DIST_DIR ?? 'dist'
const startModeConfig = getStartModeConfig()
const bundledDev = process.env.E2E_VITE_BUNDLED_DEV === 'true'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  experimental: bundledDev ? { bundledDev: true } : undefined,
  build: {
    outDir,
  },
  server: {
    port: 3000,
  },
  plugins: [tanstackStart(startModeConfig), viteReact()],
  // react-tweet's package.json exports resolve to `index.client.js` which
  // matches the default **/*.client.* deny pattern.  Bundling it via
  // noExternal must NOT trigger a false-positive import-protection violation.
  ssr: {
    noExternal: ['react-tweet'],
  },
})
