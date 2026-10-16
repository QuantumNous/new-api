import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/get-and-any')({
  server: {
    handlers: {
      GET: () =>
        new Response(null, {
          headers: { 'x-handler': 'GET' },
        }),
      ANY: ({ request }) =>
        new Response(null, {
          headers: { 'x-handler': 'ANY', 'x-method': request.method },
        }),
    },
  },
})
