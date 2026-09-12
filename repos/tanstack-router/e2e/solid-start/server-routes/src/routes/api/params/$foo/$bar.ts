import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/api/params/$foo/$bar')({
  server: {
    handlers: {
      GET: ({ params }) => {
        return new Response('hello, ' + params.foo + ' and ' + params.bar)
      },
    },
  },
})
