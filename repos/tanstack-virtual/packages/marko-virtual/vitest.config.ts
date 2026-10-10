import { defineConfig } from 'vitest/config'
import marko from '@marko/vite'
import packageJson from './package.json'

// This config is used by `vitest` only.
// @marko/vite is an app plugin requiring SSR+browser build order — it must
// never appear in the library build (vite.config.ts).
export default defineConfig({
  plugins: [marko() as any],
  test: {
    name: packageJson.name,
    dir: './tests',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
