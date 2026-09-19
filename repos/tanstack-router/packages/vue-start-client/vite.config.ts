import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import vueJsx from '@vitejs/plugin-vue-jsx'
import packageJson from './package.json'
import type { ViteUserConfig } from 'vitest/config'

const config = defineConfig({
  plugins: [vueJsx()] as ViteUserConfig['plugins'],
  test: {
    typecheck: { enabled: true },
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
    entry: './src/index.tsx',
    cjs: false,
  }),
)
