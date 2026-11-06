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
    // Keep lazily-compiled code alive for the whole run: the pinned
    // collections age code fast enough for V8 to flush unused bytecode,
    // and the mid-measurement recompile injects a multi-MB allocation
    // burst at a run-dependent time.
    execArgv: [
      '--no-flush-bytecode',
      // Pre-size the V8 heap so no space has to grow mid-measurement:
      // heap-growth events allocate several MB at a run-dependent moment,
      // which flips the measured peak bimodally between identical runs.
      '--initial-old-space-size=64',
      '--min-semi-space-size=16',
      '--max-semi-space-size=16',
    ],
    name: '@benchmarks/memory-server peak-large-page (vue)',
    watch: false,
    environment: 'node',
  },
})
