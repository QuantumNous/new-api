import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'
import codspeedPlugin from '@codspeed/vitest-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: rootDir,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    !!(process.env.VITEST && process.env.WITH_INSTRUMENTATION) &&
      codspeedPlugin(),
    tanstackRouter({
      target: 'solid',
      routesDirectory: `${rootDir}src/routes`,
      generatedRouteTree: `${rootDir}src/routeTree.gen.ts`,
    }),
    solid({ hot: false, dev: false }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: './src/main.tsx',
      formats: ['es'],
      fileName: 'app',
    },
  },
  resolve: {
    conditions: ['solid', 'browser'],
  },
  test: {
    name: '@benchmarks/client-nav search-params (solid)',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['../../../vitest.setup.ts'],
    server: {
      deps: {
        inline: [/@solidjs/, /@tanstack\/solid-store/],
      },
    },
  },
})
