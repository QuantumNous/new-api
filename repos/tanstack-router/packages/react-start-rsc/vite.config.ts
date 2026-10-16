import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import react from '@vitejs/plugin-react'
import { copyFilesPlugin } from '@tanstack/router-utils'
import packageJson from './package.json'

const config = defineConfig({
  resolve: {
    alias: {
      'virtual:tanstack-rsc-browser-decode': '@vitejs/plugin-rsc/browser',
    },
  },
  plugins: [
    react(),
    copyFilesPlugin({
      pattern: ['*.ts', '*.tsx', '!*.d.ts'],
      fromDir: 'src/entry',
      toDir: 'dist/plugin/entry',
    }),
  ],
  test: {
    include: ['**/*.{test-d,test,spec}.?(c|m)[jt]s?(x)'],
    name: packageJson.name,
    watch: false,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    srcDir: './src',
    entry: [
      './src/index.ts',
      './src/index.rsc.ts',
      './src/serialization.client.ts',
      './src/serialization.server.ts',
      './src/plugin/rscCssTransform.ts',
      './src/plugin/vite.ts',
      './src/entry/rsc.tsx',
      './src/rsbuild/ssr-decode.ts',
      './src/rsbuild/browser-decode.ts',
    ],
    cjs: false,
    // Externalize virtual modules and SSR-only imports - resolved at runtime by Vite plugins
    externalDeps: [
      'virtual:tanstack-rsc-runtime',
      'virtual:tanstack-rsc-browser-decode',
      'virtual:tanstack-rsc-ssr-decode',
      'virtual:tanstack-rsc-hmr',
      '#tanstack-start-server-fn-resolver',
      'react-server-dom-rspack/client.node',
      'react-server-dom-rspack/client.browser',
      'react-server-dom-rspack/server',
    ],
  }),
)
