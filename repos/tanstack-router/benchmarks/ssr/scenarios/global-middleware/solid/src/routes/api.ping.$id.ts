import { createFileRoute } from '@tanstack/solid-router'
import {
  makeServerRouteMarker,
  type GlobalMiddlewareContext,
} from '../../../shared'

export const Route = createFileRoute('/api/ping/$id')({
  server: {
    handlers: {
      GET: ({ params, context }) => {
        const middlewareContext = (context ?? {}) as GlobalMiddlewareContext

        return Response.json({
          id: params.id,
          marker: makeServerRouteMarker(params.id, middlewareContext),
          requestTrace: middlewareContext.requestTrace,
          requestTotal: middlewareContext.requestTotal,
        })
      },
    },
  },
})
