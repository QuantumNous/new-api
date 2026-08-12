import { createFileRoute } from '@tanstack/solid-router'
import { methodMws, routeMws } from '../middleware'

const allMws = [...routeMws, ...methodMws] as const

export const Route = createFileRoute('/api/chain/$id')({
  server: {
    middleware: allMws,
    handlers: {
      GET: ({ params, context }) =>
        Response.json({
          id: params.id,
          total:
            context.r1 +
            context.r2 +
            context.r3 +
            context.r4 +
            context.r5 +
            context.m1 +
            context.m2,
        }),
    },
  },
})
