import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import viteSolid from 'vite-plugin-solid'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
      cookieName: 'PARAGLIDE_LOCALE',
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
      urlPatterns: [
        {
          pattern: '/',
          localized: [
            ['en', '/'],
            ['de', '/de'],
          ],
        },
        {
          pattern: '/about',
          localized: [
            ['en', '/about'],
            ['de', '/de/ueber'],
          ],
        },
        {
          pattern: '/:path(.*)?',
          localized: [
            ['en', '/:path(.*)?'],
            ['de', '/de/:path(.*)?'],
          ],
        },
      ],
    }),
    tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
    viteSolid(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
