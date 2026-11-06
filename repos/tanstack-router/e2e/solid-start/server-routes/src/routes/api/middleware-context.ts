import { createFileRoute } from '@tanstack/solid-router'
import { createMiddleware } from '@tanstack/solid-start'

const testParentMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next({ context: { testParent: true } })
  return result
})

const testMiddleware = createMiddleware()
  .middleware([testParentMiddleware])
  .server(async ({ next }) => {
    const result = await next({ context: { test: true } })
    return result
  })

export const Route = createFileRoute('/api/middleware-context')({
  server: {
    middleware: [testMiddleware],
    handlers: {
      GET: ({ request, context }) => {
        return Response.json({
          url: request.url,
          context: context,
          expectedContext: { testParent: true, test: true },
        })
      },
    },
  },
})
