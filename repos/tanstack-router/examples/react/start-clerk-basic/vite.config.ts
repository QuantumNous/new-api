import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  // See https://github.com/TanStack/router/issues/5738
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: 'use-sync-external-store/shim/index.js', replacement: 'react' },
    ],
  },
})
