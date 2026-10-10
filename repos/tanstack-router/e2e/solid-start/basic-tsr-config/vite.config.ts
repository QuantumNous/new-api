import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      srcDirectory: './src/app',
    }),
    viteSolid({ ssr: true }),
  ],
})
