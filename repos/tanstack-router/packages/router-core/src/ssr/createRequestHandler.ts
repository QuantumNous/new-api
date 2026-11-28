import { createMemoryHistory } from '@tanstack/history'
import { mergeHeaders } from './headers'
import {
  attachRouterServerSsrUtils,
  getNormalizedURL,
  getOrigin,
} from './ssr-server'
import { normalizeSsrResponse } from './handlerCallback'
import type { HandlerCallback } from './handlerCallback'
import type { AnyHeaders } from './headers'
import type { AnyRouter } from '../router'
import type { ServerManifest } from '../manifest'

export type RequestHandler<TRouter extends AnyRouter> = (
  cb: HandlerCallback<TRouter>,
) => Promise<Response>

export function createRequestHandler<TRouter extends AnyRouter>({
  createRouter,
  request,
  getRouterManifest,
}: {
  createRouter: () => TRouter
  request: Request
  getRouterManifest?: () => ServerManifest | Promise<ServerManifest>
}): RequestHandler<TRouter> {
  return async (cb) => {
    const router = createRouter()
    let responseOwnsCleanup = false

    try {
      attachRouterServerSsrUtils({
        router,
        manifest: await getRouterManifest?.(),
      })

      // normalizing and sanitizing the pathname here for server, so we always deal with the same format during SSR.
      const { url } = getNormalizedURL(request.url, 'http://localhost')
      const origin = getOrigin(request)
      const href = url.href.replace(url.origin, '')

      // Create a history for the router
      const history = createMemoryHistory({
        initialEntries: [href],
      })

      // Update the router with the history and context
      router.update({
        history,
        origin: router.options.origin ?? origin,
      })

      await router.load()

      await router.serverSsr?.dehydrate()

      const responseHeaders = getRequestHeaders({
        router,
      })

      const response = await cb({
        request,
        router,
        responseHeaders,
      })
      const ssrResponse = normalizeSsrResponse(response)
      responseOwnsCleanup = ssrResponse.serverSsrCleanup === 'stream'
      return ssrResponse.response
    } finally {
      if (!responseOwnsCleanup) {
        // Clean up router SSR state if the callback won't handle it
        // (e.g., if an error occurred before the callback was invoked).
        // Transformed streaming response bodies clean up when consumed/cancelled.
        router.serverSsr?.cleanup()
      }
    }
  }
}

function getRequestHeaders(opts: { router: AnyRouter }): Headers {
  const matchHeaders: Array<AnyHeaders> = []
  for (const match of opts.router.stores.matches.get()) {
    matchHeaders.push(match.headers)
  }

  // Handle Redirects
  const redirect = opts.router.stores.redirect.get()
  if (redirect) {
    matchHeaders.push(redirect.headers)
  }

  return mergeHeaders(
    {
      'Content-Type': 'text/html; charset=UTF-8',
    },
    ...matchHeaders,
  )
}
