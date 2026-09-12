import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/params/$foo')({
  server: {
    handlers: {
      GET: ({ params }) => {
        return new Response('hello, ' + params.foo)
      },
    },
  },
})
