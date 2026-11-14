import { createFileRoute } from '@tanstack/solid-router'
import { reactStartHandler } from '@convex-dev/better-auth/react-start'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        return reactStartHandler(request)
      },
      POST: ({ request }) => {
        return reactStartHandler(request)
      },
    },
  },
})
