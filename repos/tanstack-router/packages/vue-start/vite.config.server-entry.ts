import { tanstackViteConfig } from '@tanstack/vite-config'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { mergeConfig, defineConfig } from 'vitest/config'

const config = defineConfig({
  plugins: [vueJsx()],
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    tsconfigPath: './tsconfig.server-entry.json',
    srcDir: './src/default-entry',
    exclude: ['./src/default-entry/client.tsx'],
    entry: ['./src/default-entry/server.ts'],
    externalDeps: ['@tanstack/vue-start/server'],
    outDir: './dist/default-entry',
    cjs: false,
  }),
)
