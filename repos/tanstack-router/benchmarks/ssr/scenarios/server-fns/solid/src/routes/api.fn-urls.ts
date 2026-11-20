import { createFileRoute } from '@tanstack/solid-router'
import { ctxEcho, echoGet, echoPost, notFounder, redirector } from '../fns'

export const Route = createFileRoute('/api/fn-urls')({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          get: echoGet.url,
          post: echoPost.url,
          redirect: redirector.url,
          notFound: notFounder.url,
          context: ctxEcho.url,
        }),
    },
  },
})
