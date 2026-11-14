import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

const outDir = process.env.E2E_DIST_DIR ?? 'dist-rsbuild-ssr'
const transformInlineCssAssets =
  process.env.CSS_INLINE_TRANSFORM_ASSETS === 'true'

export default defineConfig({
  plugins: [
    pluginReact({ splitChunks: false }),
    tanstackStart({
      server: {
        build: {
          inlineCss: transformInlineCssAssets
            ? { enabled: true, transformAssets: true }
            : true,
        },
      },
    }),
  ],
  output: {
    distPath: {
      root: outDir,
    },
  },
})
