import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import { joinURL } from 'ufo'
import { RSBUILD_ENVIRONMENT_NAMES } from './planning'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RsbuildConfig } from '@rsbuild/core'

type ServerSetupFn = Extract<
  NonNullable<NonNullable<RsbuildConfig['server']>['setup']>,
  (...args: Array<any>) => any
>
type ServerSetupContext = Parameters<ServerSetupFn>[0]
type SSRMiddleware = (
  req: IncomingMessage & { originalUrl?: string },
  res: ServerResponse,
  next: (error?: unknown) => void,
) => Promise<void>
type FetchHandler = (req: Request) => Promise<Response> | Response

type ServerEntry =
  | FetchHandler
  | {
      fetch?: FetchHandler
    }

function resolveFetchHandler(serverEntry: ServerEntry): FetchHandler {
  if (typeof serverEntry === 'function') {
    return serverEntry
  }

  if (typeof serverEntry.fetch === 'function') {
    return serverEntry.fetch.bind(serverEntry)
  }

  throw new Error(
    'Unable to resolve a request handler from Rsbuild server bundle',
  )
}

function getPublicBasePathname(publicBase: string): string {
  try {
    return new URL(publicBase, 'http://localhost').pathname
  } catch {
    return publicBase
  }
}

function restorePreviewUrl(opts: {
  req: IncomingMessage & { originalUrl?: string }
  publicBase: string
}) {
  if (opts.req.originalUrl) {
    opts.req.url = opts.req.originalUrl
  }

  const publicBasePathname = getPublicBasePathname(opts.publicBase)
  if (publicBasePathname === '/') {
    return
  }

  const url = opts.req.url ?? '/'
  if (url.startsWith(publicBasePathname)) {
    return
  }

  opts.req.url = joinURL(publicBasePathname, url)
}

async function loadDevFetchHandler(
  context: ServerSetupContext,
): Promise<FetchHandler> {
  if (context.action !== 'dev') {
    throw new Error('Cannot load Rsbuild dev SSR bundle outside dev mode')
  }

  const ssrEnv = context.server.environments[RSBUILD_ENVIRONMENT_NAMES.server]

  if (!ssrEnv) {
    throw new Error(
      `SSR environment "${RSBUILD_ENVIRONMENT_NAMES.server}" not found`,
    )
  }

  const serverEntry = await ssrEnv.loadBundle<{ default: ServerEntry }>('index')
  return resolveFetchHandler(serverEntry.default)
}

/**
 * Returns a `server.setup` function for rsbuild v2.
 *
 * Two middleware positions are used:
 *
 * 1. **Setup body** (BEFORE built-ins): Intercepts `/_serverFn/` URLs so
 *    they never reach rsbuild's htmlFallback/htmlCompletion middleware,
 *    which can swallow long base64 function IDs.
 *
 * 2. **Returned callback** (AFTER built-ins, BEFORE fallback): Handles
 *    all remaining SSR requests (page navigations). This position lets
 *    rsbuild's asset middleware serve compiled JS/CSS first.
 *
 * The middleware choreography is shared by dev and preview. The server entry
 * loader differs: dev reads from Rsbuild's in-memory environment so rebuilds
 * are reflected immediately, while preview lazy-imports the production server
 * bundle from disk.
 *
 * See rsbuild source: devMiddlewares.ts `applyDefaultMiddlewares()` and
 * previewServer.ts `startPreviewServer()`.
 */
export function createServerSetup(opts: {
  serverFnBasePath: string
  serverOutputDirectory: string
  publicBase: string
}): ServerSetupFn {
  let previewFetchHandlerPromise: Promise<FetchHandler> | undefined

  const getPreviewFetchHandler = () => {
    if (!previewFetchHandlerPromise) {
      previewFetchHandlerPromise = loadPreviewFetchHandler(
        opts.serverOutputDirectory,
      )
    }

    return previewFetchHandlerPromise
  }

  return (context) => {
    const serverFnBase = opts.serverFnBasePath

    const handleSSR: SSRMiddleware = async (req, res, next) => {
      try {
        const fetchHandler =
          context.action === 'dev'
            ? await loadDevFetchHandler(context)
            : await getPreviewFetchHandler()

        if (context.action === 'preview') {
          // Rsbuild preview's base middleware strips server.base before the
          // returned setup callback runs. Put it back before creating the Web
          // Request so Start's router sees the same URL shape as build/custom
          // servers. The early server-fn middleware runs before that base
          // middleware, so avoid prepending when the URL already has the base.
          restorePreviewUrl({ req, publicBase: opts.publicBase })
        } else if (req.originalUrl) {
          // Restore the original URL (rsbuild may rewrite to /index.html)
          req.url = req.originalUrl
        }

        const webReq = new NodeRequest({ req, res })
        const webRes = await fetchHandler(webReq)
        return sendNodeResponse(res, webRes)
      } catch (e) {
        console.error('[tanstack-start] SSR error:', e)

        const webReq = new NodeRequest({ req, res })
        if (webReq.headers.get('content-type')?.includes('application/json')) {
          return sendNodeResponse(
            res,
            new Response(
              JSON.stringify(
                {
                  status: 500,
                  error: 'Internal Server Error',
                  message:
                    'An unexpected error occurred. Please try again later.',
                  timestamp: new Date().toISOString(),
                },
                null,
                2,
              ),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }

        return next(e)
      }
    }

    // Position 1: BEFORE built-ins — intercept server function calls
    // early so they are not swallowed by htmlFallback or assetsMiddleware.
    context.server.middlewares.use(async (req, res, next) => {
      const url = req.url || '/'
      if (url.startsWith(serverFnBase)) {
        return handleSSR(req, res, next)
      }
      return next()
    })

    // Position 2: AFTER built-ins, before fallback — SSR catch-all for
    // page navigations. Assets are already handled by rsbuild middleware.
    return () => {
      context.server.middlewares.use(handleSSR)
    }
  }
}

async function loadPreviewFetchHandler(
  serverOutputDirectory: string,
): Promise<FetchHandler> {
  const serverEntryPath = resolve(serverOutputDirectory, 'index.js')
  const imported = (await import(
    pathToFileURL(serverEntryPath).toString()
  )) as { default: ServerEntry }

  try {
    return resolveFetchHandler(imported.default)
  } catch (error) {
    throw new Error(
      `Unable to resolve a request handler from Rsbuild server bundle at ${serverEntryPath}`,
      { cause: error },
    )
  }
}
