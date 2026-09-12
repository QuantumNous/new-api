import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import minifyScriptPlugin from './vite-minify-plugin'
import packageJson from './package.json'
import type { ViteUserConfig } from 'vitest/config'

const config = defineConfig({
  plugins: [minifyScriptPlugin()] as ViteUserConfig['plugins'],
  build: {
    rolldownOptions: {
      output: {
        topLevelVar: false,
      },
    },
  },
  test: {
    name: packageJson.name,
    dir: './tests',
    watch: false,
    environment: 'jsdom',
    typecheck: { enabled: true },
    // Perf tests are gated by env var and excluded from default runs.
    // To run: RUN_BACKPRESSURE_PERF=1 pnpm vitest run transformStreamBackpressure
    exclude:
      process.env.RUN_BACKPRESSURE_PERF === '1'
        ? ['**/node_modules/**']
        : ['**/*.perf.test.ts', '**/node_modules/**'],
    alias: {
      // For tests only, resolve to development.ts which returns undefined
      // so that router.isServer fallback is used
      '@tanstack/router-core/isServer': path.resolve(
        __dirname,
        'src/isServer/development.ts',
      ),
    },
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: [
      './src/index.ts',
      './src/ssr/client.ts',
      './src/ssr/server.ts',
      './src/scroll-restoration-script/client.ts',
      './src/scroll-restoration-script/server.ts',
      './src/isServer/server.ts',
      './src/isServer/client.ts',
      './src/isServer/development.ts',
    ],
    srcDir: './src',
    externalDeps: ['@tanstack/router-core/isServer'],
    tsconfigPath: './tsconfig.build.json',
  }),
)
