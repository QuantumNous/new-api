import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/api/head-redirect-fallback')({
  server: {
    handlers: {
      GET: () => redirect({ to: '/api/head-fallback', statusCode: 307 }),
    },
  },
})
