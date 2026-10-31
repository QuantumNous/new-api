import { createFileRoute } from '@tanstack/react-router'
import { churnGet, churnPost } from '../fns'

export const Route = createFileRoute('/api/fn-urls')({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          get: churnGet.url,
          post: churnPost.url,
        }),
    },
  },
})
