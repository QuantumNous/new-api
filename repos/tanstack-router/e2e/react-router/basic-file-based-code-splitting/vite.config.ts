import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      codeSplittingOptions: {
        splitBehavior: ({ routeId }) => {
          if (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            routeId === undefined ||
            routeId.startsWith('$$TSR_') ||
            // @ts-expect-error
            routeId === ''
          ) {
            console.error(
              'The routeId is empty or undefined. This should not happen.',
            )
            process.exit(1)
          }
          if (routeId === '/posts') {
            return [
              ['loader'],
              ['component'],
              ['pendingComponent', 'notFoundComponent', 'errorComponent'],
            ]
          }
        },
      },
    }),
    react(),
  ],
})
