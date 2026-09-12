import { createIsomorphicFn } from '@tanstack/start-fn-stubs'
import { createMiddleware } from './createMiddleware'
import type {
  RequestMiddlewareAfterServer,
  RequestServerOptions,
} from './createMiddleware'
import type { Register } from '@tanstack/router-core'

export const csrfSymbol = Symbol.for('tanstack-start:csrf-middleware')

export type CsrfSecFetchSite =
  | 'same-origin'
  | 'same-site'
  | 'cross-site'
  | 'none'

export type CsrfMatcher<TValue, TRegister = Register, TMiddlewares = unknown> =
  | TValue
  | Array<TValue>
  | ((
      value: TValue | (string & {}),
      ctx: RequestServerOptions<TRegister, TMiddlewares>,
    ) => boolean | Promise<boolean>)

export interface CsrfMiddlewareOptions<
  TRegister = Register,
  TMiddlewares = unknown,
> {
  /**
   * Return `true` to validate this request, or `false` to skip validation.
   *
   * @default undefined, which validates every request handled by this middleware.
   */
  filter?: (
    ctx: RequestServerOptions<TRegister, TMiddlewares>,
  ) => boolean | Promise<boolean>
  /**
   * Allowed Origin values. Defaults to the trusted request origin.
   */
  origin?: CsrfMatcher<string, TRegister, TMiddlewares>
  /**
   * Allowed Sec-Fetch-Site values.
   *
   * @default 'same-origin'
   */
  secFetchSite?: CsrfMatcher<CsrfSecFetchSite, TRegister, TMiddlewares>
  /**
   * Whether to use Referer as a fallback when Sec-Fetch-Site and Origin are absent.
   *
   * @default true
   */
  referer?:
    | boolean
    | ((
        referer: string,
        ctx: RequestServerOptions<TRegister, TMiddlewares>,
      ) => boolean | Promise<boolean>)
  /**
   * Allow requests when Sec-Fetch-Site, Origin, and Referer are all missing.
   *
   * @default false
   */
  allowRequestsWithoutOriginCheck?: boolean
  /**
   * Optional response returned when CSRF validation fails.
   *
   * @default new Response('Forbidden', { status: 403 })
   */
  failureResponse?:
    | Response
    | ((
        ctx: RequestServerOptions<TRegister, TMiddlewares>,
      ) => Response | Promise<Response>)
}

type CreateCsrfMiddleware = <TRegister, TMiddlewares>(
  opts?: CsrfMiddlewareOptions<TRegister, TMiddlewares>,
) => RequestMiddlewareAfterServer<{}, undefined, undefined>

const innerCreateCsrfMiddleware: CreateCsrfMiddleware = (opts = {}) => {
  const middleware = createMiddleware().server(async (ctx) => {
    const csrfCtx = ctx as RequestServerOptions<any, any>

    if (opts.filter && !(await opts.filter(csrfCtx))) {
      return ctx.next()
    }

    if (await isCsrfRequestAllowed(opts, csrfCtx)) {
      return ctx.next()
    }

    return getFailureResponse(opts, csrfCtx)
  })

  if (process.env.NODE_ENV !== 'production') {
    Object.defineProperty(middleware, csrfSymbol, { value: true })
  }

  return middleware
}

export const createCsrfMiddleware: CreateCsrfMiddleware =
  createIsomorphicFn().server(innerCreateCsrfMiddleware) as CreateCsrfMiddleware

export async function isCsrfRequestAllowed<TRegister, TMiddlewares>(
  opts: CsrfMiddlewareOptions<TRegister, TMiddlewares>,
  ctx: RequestServerOptions<TRegister, TMiddlewares>,
): Promise<boolean> {
  const result = await getCsrfRequestValidationResult(opts, ctx)
  return (
    result === true ||
    (result === undefined && opts.allowRequestsWithoutOriginCheck === true)
  )
}

export async function getCsrfRequestValidationResult<TRegister, TMiddlewares>(
  opts: CsrfMiddlewareOptions<TRegister, TMiddlewares>,
  ctx: RequestServerOptions<TRegister, TMiddlewares>,
): Promise<boolean | undefined> {
  const fetchSite = ctx.request.headers.get('Sec-Fetch-Site')
  if (fetchSite !== null) {
    return matchValue(opts.secFetchSite ?? 'same-origin', fetchSite, ctx)
  }

  const origin = ctx.request.headers.get('Origin')
  if (origin !== null) {
    if (opts.origin) {
      return matchValue(opts.origin, origin, ctx)
    }

    return origin === new URL(ctx.request.url).origin
  }

  const referer = ctx.request.headers.get('Referer')
  if (referer === null || opts.referer === false) {
    return undefined
  }

  if (typeof opts.referer === 'function') {
    return opts.referer(referer, ctx)
  }

  if (opts.origin) {
    const refererOrigin = getOriginFromUrl(referer)
    return (
      refererOrigin !== undefined && matchValue(opts.origin, refererOrigin, ctx)
    )
  }

  return isRefererSameOrigin(referer, new URL(ctx.request.url).origin)
}

async function matchValue<TValue extends string, TRegister, TMiddlewares>(
  matcher: CsrfMatcher<TValue, TRegister, TMiddlewares>,
  value: string,
  ctx: RequestServerOptions<TRegister, TMiddlewares>,
): Promise<boolean> {
  if (typeof matcher === 'function') {
    return matcher(value, ctx)
  }

  if (Array.isArray(matcher)) {
    // typescript is dumb for array.includes()
    return matcher.includes(value as TValue)
  }

  return value === matcher
}

function getOriginFromUrl(url: string): string | undefined {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

function isRefererSameOrigin(referer: string, requestOrigin: string): boolean {
  if (referer === requestOrigin) return true
  if (!referer.startsWith(requestOrigin)) return false
  if (referer.length === requestOrigin.length) return true
  const code = referer.charCodeAt(requestOrigin.length)
  return code === 47 /* '/' */ || code === 63 /* '?' */ || code === 35 /* '#' */
}

async function getFailureResponse<TRegister, TMiddlewares>(
  opts: CsrfMiddlewareOptions<TRegister, TMiddlewares>,
  ctx: RequestServerOptions<TRegister, TMiddlewares>,
): Promise<Response> {
  if (typeof opts.failureResponse === 'function') {
    return opts.failureResponse(ctx)
  }

  return (
    opts.failureResponse?.clone() ?? new Response('Forbidden', { status: 403 })
  )
}
