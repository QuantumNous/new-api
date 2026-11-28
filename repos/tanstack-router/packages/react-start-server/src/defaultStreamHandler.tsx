import {
  defineHandlerCallback,
  renderRouterToStream,
} from '@tanstack/react-router/ssr/server'
import { StartServer } from './StartServer'

export const defaultStreamHandler = defineHandlerCallback(
  ({ request, router, responseHeaders }) =>
    renderRouterToStream({
      request,
      router,
      responseHeaders,
      children: <StartServer router={router} />,
    }),
)
