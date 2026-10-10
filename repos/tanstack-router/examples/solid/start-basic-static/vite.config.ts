import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import { defineConfig } from 'vite'
import viteSolid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          crawlLinks: true,
        },
      },
      sitemap: {
        host: 'https://localhost:3000',
      },
      prerender: {
        failOnError: true,
        filter: (page) => {
          return !page.path.includes('exist')
        },
      },
    }),
    viteSolid({ ssr: true }),
  ],
})
