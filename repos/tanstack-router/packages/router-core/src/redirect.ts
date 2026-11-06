import type { NavigateOptions } from './link'
import type { AnyRouter, RegisteredRouter } from './router'
import type { ParsedLocation } from './location'

export type AnyRedirect = Redirect<any, any, any, any, any>

/**
 * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RedirectType)
 */
export type Redirect<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = Response & {
  options: NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
    /**
     * @internal
     * A **trusted** built location that can be used to redirect to.
     */
    _builtLocation?: ParsedLocation
  }
  redirectHandled?: boolean
}

export type RedirectOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = {
  href?: string
  /**
   * @deprecated Use `statusCode` instead
   **/
  code?: number
  /**
   * The HTTP status code to use when redirecting.
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RedirectType#statuscode-property)
   */
  statusCode?: number
  /**
   * If provided, will throw the redirect object instead of returning it. This can be useful in places where `throwing` in a function might cause it to have a return type of `never`. In that case, you can use `redirect({ throw: true })` to throw the redirect object instead of returning it.
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RedirectType#throw-property)
   */
  throw?: any
  /**
   * The HTTP headers to use when redirecting.
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RedirectType#headers-property)
   */
  headers?: HeadersInit
  /**
   * @internal
   * A **trusted** built location that can be used to redirect to.
   */
  _builtLocation?: ParsedLocation
} & NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>

export type ResolvedRedirect<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string = '',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = Redirect<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>

/**
 * Options for route-bound redirect, where 'from' is automatically set.
 * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RedirectType)
 */
export type RedirectOptionsRoute<
  TDefaultFrom extends string = string,
  TRouter extends AnyRouter = RegisteredRouter,
  TTo extends string | undefined = undefined,
  TMaskTo extends string = '',
> = Omit<
  RedirectOptions<TRouter, TDefaultFrom, TTo, TDefaultFrom, TMaskTo>,
  'from'
>

/**
 * A redirect function bound to a specific route, with 'from' pre-set to the route's fullPath.
 * This enables relative redirects like `Route.redirect({ to: './overview' })`.
 * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RedirectType)
 */
export interface RedirectFnRoute<in out TDefaultFrom extends string = string> {
  <
    TRouter extends AnyRouter = RegisteredRouter,
    const TTo extends string | undefined = undefined,
    const TMaskTo extends string = '',
  >(
    opts: RedirectOptionsRoute<TDefaultFrom, TRouter, TTo, TMaskTo>,
  ): Redirect<TRouter, TDefaultFrom, TTo, TDefaultFrom, TMaskTo>
}

/**
 * Create a redirect Response understood by TanStack Router.
 *
 * Use from route `loader`/`beforeLoad` or server functions to trigger a
 * navigation. If `throw: true` is set, the redirect is thrown instead of
 * returned. When an absolute `href` is supplied and `reloadDocument` is not
 * set, a full-document navigation is inferred.
 *
 * @param opts Options for the redirect. Common fields:
 * - `href`: absolute URL for external redirects; infers `reloadDocument`.
 * - `statusCode`: HTTP status code to use (defaults to 307).
 * - `headers`: additional headers to include on the Response.
 * - Standard navigation options like `to`, `params`, `search`, `replace`,
 *   and `reloadDocument` for internal redirects.
 * @returns A Response augmented with router navigation options.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/redirectFunction
 */
export function redirect<
  TRouter extends AnyRouter = RegisteredRouter,
  const TTo extends string | undefined = '.',
  const TFrom extends string = string,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = '',
>(
  opts: RedirectOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
): Redirect<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> {
  opts.statusCode = opts.statusCode || opts.code || 307

  if (
    !opts._builtLocation &&
    !opts.reloadDocument &&
    typeof opts.href === 'string'
  ) {
    try {
      new URL(opts.href)
      opts.reloadDocument = true
    } catch {}
  }

  const headers = new Headers(opts.headers)
  if (opts.href && headers.get('Location') === null) {
    headers.set('Location', opts.href)
  }

  const response = new Response(null, {
    status: opts.statusCode,
    headers,
  })

  ;(response as Redirect<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>).options =
    opts

  if (opts.throw) {
    throw response
  }

  return response as Redirect<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>
}

/** Check whether a value is a TanStack Router redirect Response. */
/** Check whether a value is a TanStack Router redirect Response. */
export function isRedirect(obj: any): obj is AnyRedirect {
  return obj instanceof Response && !!(obj as any).options
}

/** True if value is a redirect with a resolved `href` location. */
/** True if value is a redirect with a resolved `href` location. */
export function isResolvedRedirect(
  obj: any,
): obj is AnyRedirect & { options: { href: string } } {
  return isRedirect(obj) && !!obj.options.href
}

/** Parse a serialized redirect object back into a redirect Response. */
/** Parse a serialized redirect object back into a redirect Response. */
export function parseRedirect(obj: any) {
  if (obj !== null && typeof obj === 'object' && obj.isSerializedRedirect) {
    return redirect(obj)
  }

  return undefined
}
