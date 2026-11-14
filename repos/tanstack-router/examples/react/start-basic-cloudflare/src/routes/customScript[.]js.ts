import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/customScript.js')({
  server: {
    handlers: {
      GET: () => {
        return new Response('console.log("Hello from customScript.js!")', {
          headers: {
            'Content-Type': 'application/javascript',
          },
        })
      },
    },
  },
})
