import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import packageJson from './package.json'
import type { ViteUserConfig } from 'vitest/config'

// GC/WeakRef tests are flaky in CI because V8 does not guarantee reclamation
// timing. They are env-gated and only run with RUN_SSR_GC_TESTS=1. When the
// flag is set we additionally enable --expose-gc and use the forks pool so
// globalThis.gc() is available.
const runGcTests = process.env.RUN_SSR_GC_TESTS === '1'

const config = defineConfig({
  test: {
    name: packageJson.name,
    dir: './tests',
    watch: false,
    environment: 'jsdom',
    typecheck: { enabled: true },
    alias: {
      // For tests only, resolve to development.ts which returns undefined
      // so that router.isServer fallback is used (mirrors router-core).
      '@tanstack/router-core/isServer': path.resolve(
        __dirname,
        '../router-core/src/isServer/development.ts',
      ),
    },
    ...(runGcTests
      ? { pool: 'forks' as const, execArgv: ['--expose-gc'] }
      : {}),
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    tsconfigPath: './tsconfig.build.json',
    entry: ['./src/index.ts'],
    srcDir: './src',
  }),
)
