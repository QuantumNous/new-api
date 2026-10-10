import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import codspeedPlugin from '@codspeed/vitest-plugin'
import { tanstackStart } from '@tanstack/vue-start/plugin/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: rootDir,
  plugins: [
    !!(process.env.VITEST && process.env.WITH_INSTRUMENTATION) &&
      codspeedPlugin(),
    tanstackStart({
      srcDirectory: 'src',
    }),
    vueJsx(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: false,
  },
  test: {
    name: '@benchmarks/ssr (vue)',
    watch: false,
    environment: 'node',
  },
})
