import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'
import { getStartModeConfig } from './start-mode-config'

const outDir = process.env.E2E_DIST_DIR ?? 'dist'
const startModeConfig = getStartModeConfig()

export default defineConfig({
  plugins: [
    pluginReact({ splitChunks: false }),
    tanstackStart(startModeConfig),
  ],
  output: {
    distPath: {
      root: outDir,
    },
  },
})
