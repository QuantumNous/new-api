import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  // Use 127.0.0.1 (IPv4 explicit) instead of `localhost`. On macOS / dev
  // machines that have anything else listening on IPv6 [::1]:3000 — such as
  // an unrelated project's dev server — the OS resolves `localhost` to IPv6
  // first and the proxy lands on the wrong service, producing confusing
  // 404s on /api/* routes. Docker's host network bind is on *:3000 so the
  // backend reaches us on either family; pinning the IPv4 path is the
  // safer, predictable default.
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://127.0.0.1:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    // /v1 is proxied so the Base URL the Setup guide derives from
    // window.location (e.g. http://localhost:17231/v1) actually reaches the
    // gateway in dev — without it the guide shows a URL that 404s.
    (['/api', '/mj', '/pg', '/v1'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ]),
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact()],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    html: {
      template: './index.html',
    },
    server: {
      host: '0.0.0.0',
      // Pinned to 17231 (uncommon, unlikely to clash with other dev servers).
      // 3000/3001 routinely collide with Node/Next/CRA/Vite defaults; we own
      // 17231 for DeepRouter so the URL is stable across machines.
      port: 17231,
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      // Speed up repeated `rsbuild build` (local + CI when node_modules/.cache is preserved).
      // @see https://v2.rsbuild.dev/config/performance/build-cache
      buildCache: {
        cacheDigest: [process.env.VITE_REACT_APP_VERSION],
      },
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
