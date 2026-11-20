import { createMemoryHistory } from '@tanstack/history'
import {
  createCsrfMiddleware,
  createNullProtoObject,
  csrfSymbol,
  flattenMiddlewares,
  mergeHeaders,
  safeObjectMerge,
} from '@tanstack/start-client-core'
import {
  executeRewriteInput,
  isRedirect,
  isResolvedRedirect,
} from '@tanstack/router-core'
import {
  attachRouterServerSsrUtils,
  getNormalizedURL,
  getOrigin,
  isSsrResponse,
  normalizeSsrResponse,
  replaceSsrResponse,
  stripSsrResponseBody,
} from '@tanstack/router-core/ssr/server'
import {
  getStartContext,
  runWithStartContext,
} from '@tanstack/start-storage-context'
import { requestHandler } from './request-response'
import { getStartManifest } from './router-manifest'
import { handleServerAction } from './server-functions-handler'
import { createEarlyHintsCollector } from './early-hints'
import {
  createCachedBaseManifestLoader,
  createFinalManifestResolver,
} from './finalManifest'

import { HEADERS } from './constants'
import { ServerFunctionSerializationAdapter } from './serializer/ServerFunctionSerializationAdapter'
import type {
  AnyFunctionMiddleware,
  AnyRequestMiddleware,
  AnyStartInstanceOptions,
  RouteMethod,
  RouteMethodHandlerFn,
  RouterEntry,
  StartEntry,
} from '@tanstack/start-client-core'
import type { RequestHandler } from './request-handler'
import type {
  AnyRoute,
  AnyRouter,
  AnySerializationAdapter,
  Register,
} from '@tanstack/router-core'
import type {
  HandlerCallback,
  HandlerCallbackResult,
  SsrResponse,
} from '@tanstack/router-core/ssr/server'
import type { FinalManifestOptions } from './finalManifest'

type TODO = any

type AnyMiddlewareServerFn =
  | AnyRequestMiddleware['options']['server']
  | AnyFunctionMiddleware['options']['server']

export interface CreateStartHandlerOptions extends FinalManifestOptions {
  handler: HandlerCallback<AnyRouter>
}

function getStartResponseHeaders(opts: { router: AnyRouter }) {
  const headers = mergeHeaders(
    {
      'Content-Type': 'text/html; charset=utf-8',
    },
    ...opts.router.stores.matches.get().map((match) => {
      return match.headers
    }),
  )
  return headers
}

interface PluginAdaptersEntry {
  hasPluginAdapters: boolean
  pluginSerializationAdapters: Array<AnySerializationAdapter>
}

interface Entries {
  startEntry: StartEntry
  routerEntry: RouterEntry
  pluginAdapters: PluginAdaptersEntry
}

// Cached entries - promises stored immediately to prevent concurrent imports
// that can cause race conditions during module initialization
let entriesPromise: Promise<Entries> | undefined
let hasWarnedMissingCsrfMiddleware = false
const defaultCsrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})
const getCachedBaseManifest = createCachedBaseManifestLoader(() =>
  getStartManifest(),
)
const getProdBaseManifest: typeof getStartManifest = () =>
  getCachedBaseManifest()
const getBaseManifest =
  process.env.TSS_DEV_SERVER === 'true' ? getStartManifest : getProdBaseManifest
const createEarlyHintsForRequest: typeof createEarlyHintsCollector =
  process.env.TSS_DEV_SERVER === 'true'
    ? () => undefined
    : createEarlyHintsCollector

async function loadEntries(): Promise<Entries> {
  const [routerEntry, startEntry, pluginAdapters] = await Promise.all([
    // @ts-ignore When building, we currently don't respect tsconfig.ts' `include` so we are not picking up the .d.ts from start-client-core
    import('#tanstack-router-entry'),
    // @ts-ignore When building, we currently don't respect tsconfig.ts' `include` so we are not picking up the .d.ts from start-client-core
    import('#tanstack-start-entry'),
    // @ts-ignore When building, we currently don't respect tsconfig.ts' `include` so we are not picking up the .d.ts from start-client-core
    import('#tanstack-start-plugin-adapters'),
  ])
  return {
    routerEntry: routerEntry as unknown as RouterEntry,
    startEntry: startEntry as unknown as StartEntry,
    pluginAdapters: pluginAdapters as unknown as PluginAdaptersEntry,
  }
}

function getEntries() {
  if (!entriesPromise) {
    entriesPromise = loadEntries()
  }
  return entriesPromise
}

function hasCsrfMiddleware(
  middlewares: Array<AnyRequestMiddleware | AnyFunctionMiddleware>,
): boolean {
  return middlewares.some((middleware) => csrfSymbol in middleware)
}

function warnMissingCsrfMiddlewareOnce() {
  if (hasWarnedMissingCsrfMiddleware) return
  hasWarnedMissingCsrfMiddleware = true

  console.warn(`TanStack Start server functions are not protected by the CSRF middleware.

Server functions are same-origin RPC endpoints and should be protected from cross-site requests.

Add the CSRF middleware in src/start.ts:

  const csrfMiddleware = createCsrfMiddleware({
    filter: (ctx) => ctx.handlerType === 'serverFn',
  })

  export const startInstance = createStart(() => ({
    requestMiddleware: [csrfMiddleware],
  }))

If you intentionally handle CSRF another way, disable this warning:

  tanstackStart({
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  })`)
}

// Pre-computed constants
const ROUTER_BASEPATH = process.env.TSS_ROUTER_BASEPATH || '/'
const SERVER_FN_BASE = process.env.TSS_SERVER_FN_BASE
const IS_PRERENDERING = process.env.TSS_PRERENDERING === 'true'
const IS_SHELL_ENV = process.env.TSS_SHELL === 'true'
const IS_DEV = process.env.NODE_ENV === 'development'

// Reusable error messages
const ERR_NO_RESPONSE = IS_DEV
  ? `It looks like you forgot to return a response from your server route handler. If you want to defer to the app router, make sure to have a component set in this route.`
  : 'Internal Server Error'

const ERR_NO_DEFER = IS_DEV
  ? `You cannot defer to the app router if there is no component defined on this route.`
  : 'Internal Server Error'

function throwRouteHandlerError(): never {
  throw new Error(ERR_NO_RESPONSE)
}

function throwIfMayNotDefer(): never {
  throw new Error(ERR_NO_DEFER)
}

/**
 * Check if a value is a special response (Response or Redirect)
 */
function isSpecialResponse(value: unknown): value is Response {
  return value instanceof Response || isRedirect(value)
}

/**
 * Normalize middleware result to context shape
 */
function handleCtxResult(result: TODO) {
  if (isSsrResponse(result) || isSpecialResponse(result)) {
    return { response: result }
  }
  return result
}

/**
 * Execute a middleware chain
 */
async function executeMiddleware(
  middlewares: Array<TODO>,
  ctx: TODO,
): Promise<{ ctx: TODO; response: HandlerCallbackResult }> {
  let index = -1
  let streamResponse:
    | Extract<SsrResponse, { serverSsrCleanup: 'stream' }>
    | undefined

  const setResponse = (response: TODO) => {
    if (isSsrResponse(response)) {
      if (response.serverSsrCleanup === 'stream') {
        streamResponse = response
      }
      ctx.response = response.response
      return
    }

    ctx.response = response
  }

  const disposeStreamResponse = async (reason: string) => {
    const response = streamResponse
    if (!response) {
      return
    }

    streamResponse = undefined
    const currentResponse = ctx.response
    if (
      currentResponse === response.response ||
      (currentResponse instanceof Response &&
        response.response.body !== null &&
        currentResponse.body === response.response.body)
    ) {
      ctx.response = undefined
    }
    await response.dispose(reason)
  }

  const getFinalResponse = async (): Promise<HandlerCallbackResult> => {
    const response = ctx.response
    if (!response) {
      throwRouteHandlerError()
    }

    if (!streamResponse) {
      return response
    }

    if (response === streamResponse.response) {
      return streamResponse
    }

    if (
      streamResponse.response.body !== null &&
      response.body === streamResponse.response.body
    ) {
      return { ...streamResponse, response }
    }

    await disposeStreamResponse('middleware response replaced')
    return response
  }

  const next = async (nextCtx?: TODO): Promise<TODO> => {
    // Merge context if provided using safeObjectMerge for prototype pollution prevention
    if (nextCtx) {
      if (nextCtx.context) {
        ctx.context = safeObjectMerge(ctx.context, nextCtx.context)
      }
      // Copy own properties except context (Object.keys returns only own enumerable properties)
      for (const key of Object.keys(nextCtx)) {
        if (key === 'response') {
          setResponse(nextCtx.response)
        } else if (key !== 'context') {
          ctx[key] = nextCtx[key]
        }
      }
    }

    index++
    const middleware = middlewares[index]
    if (!middleware) return ctx

    let result: TODO
    try {
      result = await middleware({ ...ctx, next })
    } catch (err) {
      if (isSpecialResponse(err)) {
        setResponse(err)
        return ctx
      }
      await disposeStreamResponse('middleware error')
      throw err
    }

    const normalized = handleCtxResult(result)
    if (normalized) {
      if (normalized.response !== undefined) {
        setResponse(normalized.response)
      }
      if (normalized.context) {
        ctx.context = safeObjectMerge(ctx.context, normalized.context)
      }
    }

    return ctx
  }

  await next()
  return { ctx, response: await getFinalResponse() }
}

/**
 * Wrap a route handler as middleware
 */
function handlerToMiddleware(
  handler: RouteMethodHandlerFn<any, AnyRoute, any, any, any, any, any>,
  mayDefer: boolean = false,
): TODO {
  if (mayDefer) {
    return handler
  }
  return async (ctx: TODO) => {
    const response = await handler({ ...ctx, next: throwIfMayNotDefer })
    if (!response) {
      throwRouteHandlerError()
    }
    return response
  }
}

/**
 * Creates the TanStack Start request handler.
 *
 * @example Backwards-compatible usage (handler callback only):
 * ```ts
 * export default createStartHandler(defaultStreamHandler)
 * ```
 *
 * @example With CDN URL rewriting:
 * ```ts
 * export default createStartHandler({
 *   handler: defaultStreamHandler,
 *   transformAssets: 'https://cdn.example.com',
 * })
 * ```
 *
 * @example With per-request URL rewriting:
 * ```ts
 * export default createStartHandler({
 *   handler: defaultStreamHandler,
 *   transformAssets: {
 *     transform: ({ url }) => {
 *       const cdnBase = getRequest().headers.get('x-cdn-base') || ''
 *       return { href: `${cdnBase}${url}` }
 *     },
 *     cache: false,
 *   },
 * })
 * ```
 */
export function createStartHandler<TRegister = Register>(
  cbOrOptions: HandlerCallback<AnyRouter> | CreateStartHandlerOptions,
): RequestHandler<TRegister> {
  const handlerOptions: FinalManifestOptions =
    typeof cbOrOptions === 'function' ? {} : cbOrOptions
  const cb: HandlerCallback<AnyRouter> =
    typeof cbOrOptions === 'function' ? cbOrOptions : cbOrOptions.handler
  const finalManifestResolver = createFinalManifestResolver({
    ...handlerOptions,
    cacheCreateTransform: process.env.TSS_DEV_SERVER !== 'true',
  })
  const resolveManifestForRequest =
    process.env.TSS_DEV_SERVER === 'true'
      ? finalManifestResolver.resolveUncached
      : finalManifestResolver.resolveCached

  if (process.env.TSS_DEV_SERVER !== 'true') {
    finalManifestResolver.warmup({
      getBaseManifest: () => getBaseManifest(undefined),
    })
  }

  const startRequestResolver: RequestHandler<Register> = async (
    request,
    requestOpts,
  ) => {
    let router: AnyRouter | null = null as AnyRouter | null
    let responseOwnsCleanup = false as boolean

    try {
      // normalizing and sanitizing the pathname here for server, so we always deal with the same format during SSR.
      // during normalization paths like '//posts' are flattened to '/posts'.
      // in these cases we would prefer to redirect to the new path
      const { url, handledProtocolRelativeURL } = getNormalizedURL(request.url)
      const href = url.pathname + url.search + url.hash
      const origin = getOrigin(request)

      if (handledProtocolRelativeURL) {
        return Response.redirect(url, 308)
      }

      const entries = await getEntries()
      const hasStartInstance = !!entries.startEntry.startInstance
      const startOptions: AnyStartInstanceOptions =
        (await entries.startEntry.startInstance?.getOptions()) ||
        ({} as AnyStartInstanceOptions)

      const { hasPluginAdapters, pluginSerializationAdapters } =
        entries.pluginAdapters

      const serializationAdapters = [
        ...(startOptions.serializationAdapters || []),
        ...(hasPluginAdapters ? pluginSerializationAdapters : []),
        ServerFunctionSerializationAdapter,
      ]

      const requestStartOptions = {
        ...startOptions,
        requestMiddleware: hasStartInstance
          ? startOptions.requestMiddleware
          : [defaultCsrfMiddleware],
        serializationAdapters,
      }

      // Flatten request middlewares once
      const flattenedRequestMiddlewares = requestStartOptions.requestMiddleware
        ? flattenMiddlewares(requestStartOptions.requestMiddleware)
        : []

      // Create set for deduplication
      const executedRequestMiddlewares = new Set<TODO>(
        flattenedRequestMiddlewares,
      )

      // Memoized router getter
      const getRouter = async (): Promise<AnyRouter> => {
        if (router) return router

        router = await entries.routerEntry.getRouter()

        let isShell = IS_SHELL_ENV
        if (IS_PRERENDERING && !isShell) {
          isShell = request.headers.get(HEADERS.TSS_SHELL) === 'true'
        }

        const history = createMemoryHistory({
          initialEntries: [href],
        })

        router.update({
          history,
          isShell,
          isPrerendering: IS_PRERENDERING,
          origin: router.options.origin ?? origin,
          ...{
            defaultSsr: requestStartOptions.defaultSsr,
            serializationAdapters: [
              ...requestStartOptions.serializationAdapters,
              ...(router.options.serializationAdapters || []),
            ],
          },
          basepath: ROUTER_BASEPATH,
        })

        return router
      }

      // Check for server function requests first (early exit)
      if (SERVER_FN_BASE && url.pathname.startsWith(SERVER_FN_BASE)) {
        if (
          process.env.NODE_ENV !== 'production' &&
          process.env.TSS_DISABLE_CSRF_MIDDLEWARE_WARNING !== 'true' &&
          !hasCsrfMiddleware(flattenedRequestMiddlewares)
        ) {
          warnMissingCsrfMiddlewareOnce()
        }

        const serverFnId = url.pathname
          .slice(SERVER_FN_BASE.length)
          .split('/')[0]

        if (!serverFnId) {
          throw new Error('Invalid server action param for serverFnId')
        }

        const serverFnHandler = async ({ context }: TODO) => {
          return runWithStartContext(
            {
              getRouter,
              startOptions: requestStartOptions,
              contextAfterGlobalMiddlewares: context,
              request,
              executedRequestMiddlewares,
              handlerType: 'serverFn',
            },
            () =>
              handleServerAction({
                request,
                context: requestOpts?.context,
                serverFnId,
              }),
          )
        }

        const middlewares = flattenedRequestMiddlewares.map(
          (d) => d.options.server,
        )
        const { response: middlewareResponse } = await executeMiddleware(
          [...middlewares, serverFnHandler],
          {
            request,
            pathname: url.pathname,
            handlerType: 'serverFn',
            context: createNullProtoObject(requestOpts?.context),
          },
        )

        const result = await handleRedirectResponse(
          middlewareResponse,
          request,
          getRouter,
        )
        responseOwnsCleanup = result.serverSsrCleanup === 'stream'
        return result.response
      }

      // Router execution function
      const executeRouter = async (
        serverContext: TODO,
        matchedRoutes?: ReadonlyArray<AnyRoute>,
      ): Promise<SsrResponse> => {
        const acceptHeader = request.headers.get('Accept') || '*/*'
        const acceptParts = acceptHeader.split(',')
        const supportedMimeTypes = ['*/*', 'text/html']

        const isSupported = supportedMimeTypes.some((mimeType) =>
          acceptParts.some((part) => part.trim().startsWith(mimeType)),
        )

        if (!isSupported) {
          return normalizeSsrResponse(
            Response.json(
              { error: 'Only HTML requests are supported here' },
              { status: 500 },
            ),
          )
        }

        const manifest = await resolveManifestForRequest({
          request,
          requestInlineCss: requestOpts?.inlineCss,
          getBaseManifest: () => getBaseManifest(matchedRoutes),
        })

        const earlyHints = createEarlyHintsForRequest({
          onEarlyHints: requestOpts?.onEarlyHints,
          responseLinkHeader: requestOpts?.responseLinkHeader,
        })

        earlyHints?.collectStatic({ manifest, matchedRoutes })

        const routerInstance = await getRouter()

        attachRouterServerSsrUtils({
          router: routerInstance,
          manifest,
          getRequestAssets: () =>
            getStartContext({ throwIfNotFound: false })?.requestAssets,
        })

        // `additionalContext` is request-scoped and only read from router.options
        // during load; avoid a full router.update() and redundant location parse.
        routerInstance.options.additionalContext = { serverContext }
        await routerInstance.load()

        if (routerInstance.state.redirect) {
          return normalizeSsrResponse(routerInstance.state.redirect)
        }

        earlyHints?.collectDynamic(routerInstance.stores.matches.get())

        // Pass request-scoped assets to dehydrate for manifest injection
        const ctx = getStartContext({ throwIfNotFound: false })
        await routerInstance.serverSsr!.dehydrate({
          requestAssets: ctx?.requestAssets,
        })

        const responseHeaders = getStartResponseHeaders({
          router: routerInstance,
        })
        earlyHints?.appendResponseHeaders(responseHeaders)
        const response = await cb({
          request,
          router: routerInstance,
          responseHeaders,
        })
        return normalizeSsrResponse(response)
      }

      // Main request handler
      const requestHandlerMiddleware = async ({ context }: TODO) => {
        return runWithStartContext(
          {
            getRouter,
            startOptions: requestStartOptions,
            contextAfterGlobalMiddlewares: context,
            request,
            executedRequestMiddlewares,
            handlerType: 'router',
          },
          async () => {
            try {
              return await handleServerRoutes({
                getRouter,
                request,
                url,
                executeRouter,
                context,
                executedRequestMiddlewares,
              })
            } catch (err) {
              if (err instanceof Response) {
                return err
              }
              throw err
            }
          },
        )
      }

      const middlewares = flattenedRequestMiddlewares.map(
        (d) => d.options.server,
      )
      const { response: middlewareResponse } = await executeMiddleware(
        [...middlewares, requestHandlerMiddleware],
        {
          request,
          pathname: url.pathname,
          handlerType: 'router',
          context: createNullProtoObject(requestOpts?.context),
        },
      )

      const response = await handleRedirectResponse(
        middlewareResponse,
        request,
        getRouter,
      )
      responseOwnsCleanup = response.serverSsrCleanup === 'stream'
      return response.response
    } finally {
      if (router?.serverSsr && !responseOwnsCleanup) {
        // Clean up router SSR state if it was set up but won't be cleaned up by the callback
        // (e.g., in redirect cases or early returns before the callback is invoked).
        // Transformed streaming response bodies clean up when consumed/cancelled.
        router.serverSsr.cleanup()
      }
      router = null
    }
  }

  return requestHandler(startRequestResolver)
}

async function handleRedirectResponse(
  response: HandlerCallbackResult,
  request: Request,
  getRouter: () => Promise<AnyRouter>,
): Promise<SsrResponse> {
  const ssrResponse = normalizeSsrResponse(response)
  if (!isRedirect(ssrResponse.response)) {
    return ssrResponse
  }

  if (isResolvedRedirect(ssrResponse.response)) {
    if (request.headers.get('x-tsr-serverFn') === 'true') {
      return replaceSsrResponse(
        ssrResponse,
        Response.json(
          { ...ssrResponse.response.options, isSerializedRedirect: true },
          { headers: ssrResponse.response.headers },
        ),
        'redirect response replaced',
      )
    }
    return ssrResponse
  }

  const opts = ssrResponse.response.options
  if (opts.to && typeof opts.to === 'string' && !opts.to.startsWith('/')) {
    throw new Error(
      `Server side redirects must use absolute paths via the 'href' or 'to' options. The redirect() method's "to" property accepts an internal path only. Use the "href" property to provide an external URL. Received: ${JSON.stringify(opts)}`,
    )
  }

  if (
    ['params', 'search', 'hash'].some(
      (d) => typeof (opts as TODO)[d] === 'function',
    )
  ) {
    throw new Error(
      `Server side redirects must use static search, params, and hash values and do not support functional values. Received functional values for: ${Object.keys(
        opts,
      )
        .filter((d) => typeof (opts as TODO)[d] === 'function')
        .map((d) => `"${d}"`)
        .join(', ')}`,
    )
  }

  const router = await getRouter()
  const redirect = router.resolveRedirect(ssrResponse.response)

  if (request.headers.get('x-tsr-serverFn') === 'true') {
    return replaceSsrResponse(
      ssrResponse,
      Response.json(
        { ...ssrResponse.response.options, isSerializedRedirect: true },
        { headers: ssrResponse.response.headers },
      ),
      'redirect response replaced',
    )
  }

  return replaceSsrResponse(ssrResponse, redirect, 'redirect response replaced')
}

async function handleServerRoutes({
  getRouter,
  request,
  url,
  executeRouter,
  context,
  executedRequestMiddlewares,
}: {
  getRouter: () => Promise<AnyRouter>
  request: Request
  url: URL
  executeRouter: (
    serverContext: any,
    matchedRoutes?: ReadonlyArray<AnyRoute>,
  ) => Promise<SsrResponse>
  context: any
  executedRequestMiddlewares: Set<AnyRequestMiddleware>
}): Promise<SsrResponse> {
  const router = await getRouter()
  const rewrittenUrl = executeRewriteInput(router.rewrite, url)
  const pathname = rewrittenUrl.pathname
  // this will perform a fuzzy match, however for server routes we need an exact match
  // if the route is not an exact match, executeRouter will handle rendering the app router
  // the match will be cached internally, so no extra work is done during the app router render
  const { matchedRoutes, foundRoute, routeParams } =
    router.getMatchedRoutes(pathname)

  const isExactMatch = foundRoute && routeParams['**'] === undefined

  // Collect and dedupe route middlewares
  const routeMiddlewares: Array<AnyMiddlewareServerFn> = []

  // Collect middleware from matched routes, filtering out those already executed
  // in the request phase
  for (const route of matchedRoutes) {
    const serverMiddleware = route.options.server?.middleware as
      | Array<AnyRequestMiddleware>
      | undefined
    if (serverMiddleware) {
      const flattened = flattenMiddlewares(serverMiddleware)
      for (const m of flattened) {
        if (!executedRequestMiddlewares.has(m)) {
          routeMiddlewares.push(m.options.server)
        }
      }
    }
  }

  // Add handler middleware if exact match
  const server = foundRoute?.options.server
  let isHeadFallback = false
  if (server?.handlers && isExactMatch) {
    const handlers =
      typeof server.handlers === 'function'
        ? server.handlers({ createHandlers: (d: any) => d })
        : server.handlers

    const requestMethod = request.method.toUpperCase() as RouteMethod
    // Per RFC 9110 §9.3.2, HEAD must return the same header fields as GET.
    // Priority for HEAD: explicit HEAD handler → GET → ANY (last resort).
    const handler =
      requestMethod === 'HEAD'
        ? (handlers['HEAD'] ?? handlers['GET'] ?? handlers['ANY'])
        : (handlers[requestMethod] ?? handlers['ANY'])
    isHeadFallback =
      requestMethod === 'HEAD' && handler !== undefined && !handlers['HEAD']

    if (handler) {
      const mayDefer = !!foundRoute.options.component

      if (typeof handler === 'function') {
        routeMiddlewares.push(handlerToMiddleware(handler, mayDefer))
      } else {
        if (handler.middleware?.length) {
          const handlerMiddlewares = flattenMiddlewares(handler.middleware)
          for (const m of handlerMiddlewares) {
            routeMiddlewares.push(m.options.server)
          }
        }
        if (handler.handler) {
          routeMiddlewares.push(handlerToMiddleware(handler.handler, mayDefer))
        }
      }
    }
  }

  // Final middleware: execute router with matched routes for dev styles
  routeMiddlewares.push(((ctx: TODO) =>
    executeRouter(ctx.context, matchedRoutes)) as TODO)

  const { ctx, response } = await executeMiddleware(routeMiddlewares, {
    request,
    context,
    params: routeParams,
    pathname,
    handlerType: 'router',
  })

  // RFC 9110 §9.3.2: HEAD must carry the same header fields as GET but no body.
  // Resolve any redirect before stripping so the Location header survives.
  if (isHeadFallback) {
    if (!ctx.response) {
      throwRouteHandlerError()
    }

    const resolved = await handleRedirectResponse(response, request, getRouter)
    return stripSsrResponseBody(resolved, 'HEAD body stripped')
  }

  return normalizeSsrResponse(response)
}
