import { createFileRoute } from '@tanstack/react-router'

// A server-only route with only a GET handler.
// Used to test that HEAD requests fall back to the GET handler per RFC 9110.
export const Route = createFileRoute('/api/head-fallback')({
  server: {
    handlers: {
      GET: () =>
        new Response('body', {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        }),
    },
  },
})
