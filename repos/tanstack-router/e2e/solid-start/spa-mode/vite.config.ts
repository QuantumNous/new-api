import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: 'index.html',
          crawlLinks: true,
        },
      },
      pages: [
        {
          path: '/posts/1',
          prerender: { enabled: true, outputPath: '/posts/1/index.html' },
        },
      ],
    }),
    viteSolid({ ssr: true }),
  ],
})
