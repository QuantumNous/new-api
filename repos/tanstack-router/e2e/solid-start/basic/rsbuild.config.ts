import { defineConfig } from '@rsbuild/core'
import { pluginBabel } from '@rsbuild/plugin-babel'
import { pluginSolid } from '@rsbuild/plugin-solid'
import { tanstackStart } from '@tanstack/solid-start/plugin/rsbuild'

const outDir = process.env.E2E_DIST_DIR ?? 'dist'

export default defineConfig({
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginSolid(),
    tanstackStart(),
  ],
  output: {
    distPath: {
      root: outDir,
    },
  },
})
