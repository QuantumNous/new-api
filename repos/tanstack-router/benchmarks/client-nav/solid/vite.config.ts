import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'
import codspeedPlugin from '@codspeed/vitest-plugin'

// Anchor the project root to the package directory so this config resolves
// identically when run directly and as part of an aggregate `projects` config.
const rootDir = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: rootDir,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    !!(process.env.VITEST && process.env.WITH_INSTRUMENTATION) &&
      codspeedPlugin(),
    solid({ hot: false, dev: false }),
  ],
  build: {
    outDir: './solid/dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: './solid/app.tsx',
      formats: ['es'],
      fileName: 'app',
    },
  },
  resolve: {
    conditions: ['solid', 'browser'],
  },
  test: {
    name: '@benchmarks/client-nav (solid)',
    watch: false,
    environment: 'jsdom',
    setupFiles: [`${rootDir}vitest.setup.ts`],
    server: {
      deps: {
        inline: [/@solidjs/, /@tanstack\/solid-store/],
      },
    },
  },
})
