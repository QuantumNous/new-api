import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

// Allow env var to override the import protection behavior.
// Default: 'mock' (build completes, violations logged as warnings).
// Set BEHAVIOR=error to test that the build fails on violations.
const behavior = (process.env.BEHAVIOR ?? 'mock') as 'mock' | 'error'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      importProtection: {
        behavior,
        log: 'always',
        // Custom file patterns: NOT the default `.server.*` / `.client.*`.
        // Uses `.backend.*` for server-only files (denied in client env)
        // and `.frontend.*` for client-only files (denied in server env).
        client: {
          files: ['**/*.backend.*'],
        },
        server: {
          files: ['**/*.frontend.*'],
        },
        onViolation: (info) => {
          void info
        },
      },
    }),
    viteReact(),
  ],
})
