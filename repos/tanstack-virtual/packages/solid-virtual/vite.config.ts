import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import solid from 'vite-plugin-solid'

const config = defineConfig({
  plugins: [solid()],
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: './src/index.tsx',
    srcDir: './src',
  }),
)
