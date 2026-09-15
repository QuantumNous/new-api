import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
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
    vue(),
    vueJsx(),
  ],
  build: {
    outDir: './vue/dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: './vue/app.tsx',
      formats: ['es'],
      fileName: 'app',
    },
  },
  test: {
    name: '@benchmarks/client-nav (vue)',
    watch: false,
    environment: 'jsdom',
    setupFiles: [`${rootDir}vitest.setup.ts`],
  },
})
