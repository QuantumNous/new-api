import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import solid from 'vite-plugin-solid'
import packageJson from './package.json'
import type { ViteUserConfig } from 'vitest/config'

const config = defineConfig(({ mode }) => {
  if (mode === 'server') {
    return {
      plugins: [solid({ ssr: true })] as ViteUserConfig['plugins'],
      test: {
        name: `${packageJson.name} (server)`,
        dir: './tests/server',
        watch: false,
        environment: 'node',
        typecheck: { enabled: true },
        server: {
          deps: {
            inline: [/@solidjs/, /@tanstack\/solid-store/],
          },
        },
      },
    }
  }

  return {
    plugins: [solid()] as ViteUserConfig['plugins'],
    // Add 'development' condition for tests to resolve @tanstack/router-core/isServer
    // to the development export (isServer = undefined) instead of node (isServer = true)
    ...(process.env.VITEST && {
      resolve: {
        conditions: ['development'],
      },
    }),
    test: {
      name: packageJson.name,
      dir: './tests',
      exclude: ['server'],
      watch: false,
      environment: 'jsdom',
      typecheck: { enabled: true },
      setupFiles: ['./tests/setupTests.tsx'],
      server: {
        deps: {
          inline: [/@solidjs/, /@tanstack\/solid-store/],
        },
      },
    },
  }
})

export default defineConfig((env) =>
  mergeConfig(
    config(env),
    tanstackViteConfig({
      tsconfigPath: './tsconfig.build.json',
      entry: [
        './src/index.tsx',
        './src/index.dev.tsx',
        './src/ssr/client.ts',
        './src/ssr/server.ts',
      ],
      srcDir: './src',
    }),
  ),
)
