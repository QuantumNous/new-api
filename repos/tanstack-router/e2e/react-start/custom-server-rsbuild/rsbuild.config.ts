import path from 'node:path'
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

// Stress-test fixture for `<Scripts />` and the start manifest under a
// non-default client chunk layout. The combination that matters for the
// repro is:
//
//   - `client.output: 'iife'` — emit the client entry as a self-executing
//     script. The manifest uses plain script tags and classic script preloads;
//     setting IIFE here exercises that non-module asset path.
//
//   - Client `runtimeChunk: 'single'` — extracts the webpack runtime into
//     its own chunk. With IIFE plain scripts, the entry can't bootstrap
//     until the runtime has executed, so `<Scripts />` has to emit a
//     `<script>` for the runtime chunk (not just a preload). This was
//     the regression this fixture covers.
//
//   - `client.distPath.root` + `distPath.js: ''` — flat layout, JS at the
//     dist root. Matches the path `express-server.ts` serves via
//     `express.static('dist/client')`.
//
//   - `performance.buildCache: true` — exercise the rspack persistent
//     cache, including warm-restart paths.
//
//   - `output.assetPrefix: '/static/'` — force manifest URLs through an
//     explicit prefix.
export default defineConfig({
  plugins: [
    pluginReact({ splitChunks: false }),
    tanstackStart({
      rsbuild: {
        installDevServerMiddleware: false,
        client: {
          output: 'iife',
        },
      },
    }),
  ],
  performance: {
    buildCache: true,
  },
  output: {
    assetPrefix: '/static/',
  },
  environments: {
    client: {
      output: {
        distPath: {
          root: path.resolve(__dirname, 'dist/client'),
          js: '',
        },
      },
      tools: {
        rspack: (config) => {
          config.optimization = {
            ...(config.optimization ?? {}),
            runtimeChunk: 'single',
          }
        },
      },
    },
  },
})
