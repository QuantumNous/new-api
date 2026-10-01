import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import packageJson from './package.json'

export default defineConfig(({ command }) =>
  mergeConfig(
    {
      define:
        command === 'build'
          ? {
              'import.meta.hot': 'import.meta.hot',
            }
          : undefined,
      test: {
        typecheck: { enabled: true },
        name: packageJson.name,
        watch: false,
        environment: 'jsdom',
      },
    },
    tanstackViteConfig({
      tsconfigPath: './tsconfig.build.json',
      srcDir: './src',
      entry: [
        './src/index.tsx',
        './src/client/index.ts',
        './src/client-rpc/index.ts',
        './src/hydration/constants.ts',
        './src/hydration.ts',
        './src/hydration/runtime.ts',
        './src/fake-entries/start.ts',
        './src/fake-entries/router.ts',
        './src/empty-plugin-adapters.ts',
      ],
      cjs: false,
      externalDeps: [
        '#tanstack-start-entry',
        '#tanstack-router-entry',
        '#tanstack-start-plugin-adapters',
      ],
    }),
  ),
)
