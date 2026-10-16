import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  base: '/custom/basepath',
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      vite: { installDevServerMiddleware: true },
    }),
    viteReact(),
  ],
})
