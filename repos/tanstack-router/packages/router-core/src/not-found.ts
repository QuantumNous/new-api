import type { RouteIds } from './routeInfo'
import type { RegisteredRouter } from './router'

export type NotFoundError = {
  /**
    @deprecated
    Use `routeId: rootRouteId` instead
  */
  global?: boolean
  /**
    @private
    Do not use this. It's used internally to indicate a path matching error
  */
  _global?: boolean
  data?: any
  throw?: boolean
  routeId?: RouteIds<RegisteredRouter['routeTree']>
  headers?: HeadersInit
}

/**
 * Create a not-found error object recognized by TanStack Router.
 *
 * Throw this from loaders/actions to trigger the nearest `notFoundComponent`.
 * Use `routeId` to target a specific route's not-found boundary. If `throw`
 * is true, the error is thrown instead of returned.
 *
 * @param options Optional settings including `routeId`, `headers`, and `throw`.
 * @returns A not-found error object that can be thrown or returned.
 * @link https://tanstack.com/router/latest/docs/router/framework/react/api/router/notFoundFunction
 */
export function notFound(options: NotFoundError = {}) {
  ;(options as any).isNotFound = true
  if (options.throw) throw options
  return options
}

/** Determine if a value is a TanStack Router not-found error. */
export function isNotFound(obj: any): obj is NotFoundError {
  return obj?.isNotFound === true
}
