import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import solid from 'vite-plugin-solid'

const config = defineConfig({
  plugins: [solid()],
})

const merged = mergeConfig(
  config,
  tanstackViteConfig({
    tsconfigPath: './tsconfig.build.json',
    entry: './src/index.tsx',
    srcDir: './src',
    bundledDeps: ['solid-js', 'solid-js/web'],
  }),
)

merged.build.rolldownOptions.output.manualChunks = undefined
merged.build.rolldownOptions.output.preserveModules = false

export default merged
