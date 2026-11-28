import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import { copyFilesPlugin } from '@tanstack/router-utils'
import vueJsx from '@vitejs/plugin-vue-jsx'
import packageJson from './package.json'

const config = defineConfig({
  plugins: [
    vueJsx(),
    copyFilesPlugin({
      pattern: ['*.ts', '*.tsx', '!*.d.ts'],
      fromDir: 'src/default-entry',
      toDir: 'dist/plugin/default-entry',
    }),
  ],
  test: {
    name: packageJson.name,
    watch: false,
    environment: 'jsdom',
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    tsconfigPath: './tsconfig.build.json',
    srcDir: './src',
    exclude: ['./src/default-entry'],
    entry: [
      './src/index.ts',
      './src/client.tsx',
      './src/client-rpc.ts',
      './src/ssr-rpc.ts',
      './src/server-rpc.ts',
      './src/server.tsx',
      './src/plugin/rsbuild.ts',
      './src/plugin/vite.ts',
      './src/server-only.ts',
      './src/client-only.ts',
    ],
    externalDeps: ['@tanstack/vue-start-client', '@tanstack/vue-start-server'],
    cjs: false,
  }),
)
