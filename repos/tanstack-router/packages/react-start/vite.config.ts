import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import { copyFilesPlugin } from '@tanstack/router-utils'
import packageJson from './package.json'

const config = defineConfig({
  test: {
    name: packageJson.name,
    watch: false,
    environment: 'jsdom',
  },
  plugins: [
    copyFilesPlugin({
      pattern: ['*.ts', '*.tsx', '!*.d.ts'],
      fromDir: 'src/default-entry',
      toDir: 'dist/plugin/default-entry',
    }),
  ],
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
      './src/hydration.ts',
      './src/client-rpc.ts',
      './src/server.tsx',
      './src/server.rsc.ts',
      './src/server-rpc.ts',
      './src/ssr-rpc.ts',
      './src/rsc.tsx',
      './src/rsc.rsc.ts',
      './src/rsc/serialization/server.ts',
      './src/rsc/serialization/client.ts',
      './src/rsbuild/browser-decode.ts',
      './src/rsbuild/ssr-decode.ts',
      './src/plugin/rsbuild.ts',
      './src/plugin/vite.ts',
      './src/server-only.ts',
      './src/client-only.ts',
    ],
    externalDeps: [
      '@tanstack/react-start-client',
      '@tanstack/react-start-server',
    ],
    cjs: false,
  }),
)
