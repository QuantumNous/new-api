import { defineHandlerCallback } from '@tanstack/start-server-core'
import { renderRouterToStream } from '@tanstack/solid-router/ssr/server'
import { StartServer } from './StartServer'

export const defaultStreamHandler = defineHandlerCallback(
  async ({ request, router, responseHeaders }) =>
    await renderRouterToStream({
      request,
      router,
      responseHeaders,
      children: () => <StartServer router={router} />,
    }),
)
