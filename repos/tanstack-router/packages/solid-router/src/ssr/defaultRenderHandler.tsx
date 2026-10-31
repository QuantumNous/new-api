import { defineHandlerCallback } from '@tanstack/router-core/ssr/server'
import { RouterServer } from './RouterServer'
import { renderRouterToString } from './renderRouterToString'

export const defaultRenderHandler = defineHandlerCallback(
  ({ router, responseHeaders }) =>
    renderRouterToString({
      router,
      responseHeaders,
      children: () => <RouterServer router={router} />,
    }),
)
