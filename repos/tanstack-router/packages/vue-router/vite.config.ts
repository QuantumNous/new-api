import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { tanstackViteConfig } from '@tanstack/vite-config'
import packageJson from './package.json'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = defineConfig({
  plugins: [vueJsx()],
  resolve: {
    alias: {
      '@tanstack/vue-router': resolve(__dirname, 'src'),
    },
    // Add 'development' condition for tests to resolve @tanstack/router-core/isServer
    // to the development export (isServer = undefined) instead of node (isServer = true)
    ...(process.env.VITEST && { conditions: ['development'] }),
  },
  test: {
    name: packageJson.name,
    dir: './tests',
    watch: false,
    environment: 'jsdom',
    typecheck: { enabled: true },
    setupFiles: ['./tests/setupTests.tsx'],
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    tsconfigPath: './tsconfig.build.json',
    entry: [
      './src/index.tsx',
      './src/index.dev.tsx',
      './src/ssr/client.ts',
      './src/ssr/server.ts',
    ],
    srcDir: './src',
    cjs: false,
  }),
)
