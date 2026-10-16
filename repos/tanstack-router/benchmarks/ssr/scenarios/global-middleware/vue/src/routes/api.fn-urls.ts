import { createFileRoute } from '@tanstack/vue-router'
import { echoPost } from '../fns'

export const Route = createFileRoute('/api/fn-urls')({
  server: {
    handlers: {
      GET: () => Response.json({ post: echoPost.url }),
    },
  },
})
