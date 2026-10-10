import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import codspeedPlugin from '@codspeed/vitest-plugin'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

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
    outDir: './dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: './src/app.tsx',
      formats: ['es'],
      fileName: 'app',
    },
  },
  test: {
    name: '@benchmarks/memory-client preload-churn (vue)',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['../../../vitest.setup.ts'],
  },
})
