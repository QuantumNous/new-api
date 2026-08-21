import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

const outDir = process.env.BUNDLE_SIZE_DIST_DIR ?? 'dist-rsbuild'
const clientOutput = process.env.BUNDLE_SIZE_RSB_CLIENT_OUTPUT
const startOptions = clientOutput
  ? {
      rsbuild: {
        client: {
          output: clientOutput as 'module' | 'iife',
        },
      },
    }
  : undefined

export default defineConfig({
  logLevel: 'silent',
  plugins: [pluginReact({ splitChunks: false }), tanstackStart(startOptions)],
  output: {
    distPath: {
      root: outDir,
    },
    cleanDistPath: true,
    minify: true,
    sourceMap: false,
  },
  performance: {
    printFileSize: false,
  },
  environments: {
    client: {
      output: {
        manifest: {
          filename: 'manifest.json',
          prefix: false,
        },
      },
    },
    ssr: {
      output: {
        manifest: false,
      },
    },
  },
})
