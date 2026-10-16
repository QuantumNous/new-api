import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      rsc: {
        enabled: true,
      },
    }),
    rsc(),
    viteReact(),
  ],
})
