import { defineHandlerCallback } from '@tanstack/router-core/ssr/server'
import { renderRouterToStream } from './renderRouterToStream'
import { RouterServer } from './RouterServer'

export const defaultStreamHandler = defineHandlerCallback(
  async ({ request, router, responseHeaders }) =>
    await renderRouterToStream({
      request,
      router,
      responseHeaders,
      App: RouterServer,
    }),
)
