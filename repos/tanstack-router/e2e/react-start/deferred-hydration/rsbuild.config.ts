import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

const outDir = process.env.E2E_DIST_DIR ?? 'dist-rsbuild-ssr'

export default defineConfig({
  plugins: [pluginReact({ splitChunks: false }), tanstackStart()],
  output: {
    distPath: {
      root: outDir,
    },
  },
})
