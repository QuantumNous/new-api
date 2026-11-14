import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/api/only-any')({
  server: {
    handlers: {
      ANY: ({ request }) => {
        return Response.json(
          {
            handler: 'ANY',
            method: request.method,
          },
          { headers: { 'X-HANDLER': 'ANY', 'X-METHOD': request.method } },
        )
      },
    },
  },
})
