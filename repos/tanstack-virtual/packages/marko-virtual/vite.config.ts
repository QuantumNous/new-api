import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'

// Test config lives in vitest.config.ts (vitest uses that file first).
// This file handles only the library build via tanstackViteConfig.
// Pattern mirrors other adapters (react-virtual, etc.): mergeConfig with defineConfig.
const config = defineConfig({})

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: './src/index.ts',
    srcDir: './src',
  }),
)
