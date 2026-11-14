import type { AnyRoute, StaticDataRouteOption } from './route'
import type {
  AllContext,
  AllLoaderData,
  AllParams,
  FullSearchSchema,
  ParseRoute,
  RouteById,
  RouteIds,
} from './routeInfo'
import type { AnyRouter, RegisteredRouter, SSROption } from './router'
import type { Constrain, ControlledPromise } from './utils'

export type AnyMatchAndValue = { match: any; value: any }

export type FindValueByIndex<
  TKey,
  TValue extends ReadonlyArray<any>,
> = TKey extends `${infer TIndex extends number}` ? TValue[TIndex] : never

export type FindValueByKey<TKey, TValue> =
  TValue extends ReadonlyArray<any>
    ? FindValueByIndex<TKey, TValue>
    : TValue[TKey & keyof TValue]

export type CreateMatchAndValue<TMatch, TValue> = TValue extends any
  ? {
      match: TMatch
      value: TValue
    }
  : never

export type NextMatchAndValue<
  TKey,
  TMatchAndValue extends AnyMatchAndValue,
> = TMatchAndValue extends any
  ? CreateMatchAndValue<
      TMatchAndValue['match'],
      FindValueByKey<TKey, TMatchAndValue['value']>
    >
  : never

export type IsMatchKeyOf<TValue> =
  TValue extends ReadonlyArray<any>
    ? number extends TValue['length']
      ? `${number}`
      : keyof TValue & `${number}`
    : TValue extends object
      ? keyof TValue & string
      : never

export type IsMatchPath<
  TParentPath extends string,
  TMatchAndValue extends AnyMatchAndValue,
> = `${TParentPath}${IsMatchKeyOf<TMatchAndValue['value']>}`

export type IsMatchResult<
  TKey,
  TMatchAndValue extends AnyMatchAndValue,
> = TMatchAndValue extends any
  ? TKey extends keyof TMatchAndValue['value']
    ? TMatchAndValue['match']
    : never
  : never

export type IsMatchParse<
  TPath,
  TMatchAndValue extends AnyMatchAndValue,
  TParentPath extends string = '',
> = TPath extends `${string}.${string}`
  ? TPath extends `${infer TFirst}.${infer TRest}`
    ? IsMatchParse<
        TRest,
        NextMatchAndValue<TFirst, TMatchAndValue>,
        `${TParentPath}${TFirst}.`
      >
    : never
  : {
      path: IsMatchPath<TParentPath, TMatchAndValue>
      result: IsMatchResult<TPath, TMatchAndValue>
    }

export type IsMatch<TMatch, TPath> = IsMatchParse<
  TPath,
  TMatch extends any ? { match: TMatch; value: TMatch } : never
>

/**
 * Narrows matches based on a path
 * @experimental
 */
export const isMatch = <TMatch, TPath extends string>(
  match: TMatch,
  path: Constrain<TPath, IsMatch<TMatch, TPath>['path']>,
): match is IsMatch<TMatch, TPath>['result'] => {
  const parts = (path as string).split('.')
  let part
  let i = 0
  let value: any = match

  while ((part = parts[i++]) != null && value != null) {
    value = value[part]
  }

  return value != null
}

export interface DefaultRouteMatchExtensions {
  scripts?: unknown
  links?: unknown
  headScripts?: unknown
  meta?: unknown
  styles?: unknown
}

export interface RouteMatchExtensions extends DefaultRouteMatchExtensions {}

export interface RouteMatch<
  out TRouteId,
  out TFullPath,
  out TAllParams,
  out TFullSearchSchema,
  out TLoaderData,
  out TAllContext,
  out TLoaderDeps,
> extends RouteMatchExtensions {
  id: string
  routeId: TRouteId
  fullPath: TFullPath
  index: number
  pathname: string
  params: TAllParams
  _strictParams: TAllParams
  status: 'pending' | 'success' | 'error' | 'redirected' | 'notFound'
  isFetching: false | 'beforeLoad' | 'loader'
  error: unknown
  paramsError: unknown
  searchError: unknown
  updatedAt: number
  _nonReactive: {
    /** @internal */
    beforeLoadPromise?: ControlledPromise<void>
    /** @internal */
    loaderPromise?: ControlledPromise<void>
    /** @internal */
    pendingTimeout?: ReturnType<typeof setTimeout>
    loadPromise?: ControlledPromise<void>
    displayPendingPromise?: Promise<void>
    minPendingPromise?: ControlledPromise<void>
    dehydrated?: boolean
    /** @internal */
    error?: unknown
  }
  loaderData?: TLoaderData
  /** @internal */
  __routeContext?: Record<string, unknown>
  /** @internal */
  __beforeLoadContext?: Record<string, unknown>
  context: TAllContext
  search: TFullSearchSchema
  _strictSearch: TFullSearchSchema
  fetchCount: number
  abortController: AbortController
  cause: 'preload' | 'enter' | 'stay'
  loaderDeps: TLoaderDeps
  preload: boolean
  invalid: boolean
  headers?: Record<string, string>
  globalNotFound?: boolean
  staticData: StaticDataRouteOption
  /** This attribute is not reactive */
  ssr?: SSROption
  _forcePending?: boolean
  _displayPending?: boolean
}

export interface PreValidationErrorHandlingRouteMatch<
  TRouteId,
  TFullPath,
  TAllParams,
  TFullSearchSchema,
> {
  id: string
  routeId: TRouteId
  fullPath: TFullPath
  index: number
  pathname: string
  search:
    | { status: 'success'; value: TFullSearchSchema }
    | { status: 'error'; error: unknown }
  params:
    | { status: 'success'; value: TAllParams }
    | { status: 'error'; error: unknown }
  staticData: StaticDataRouteOption
  ssr?: boolean | 'data-only'
}

export type MakePreValidationErrorHandlingRouteMatchUnion<
  TRouter extends AnyRouter = RegisteredRouter,
  TRoute extends AnyRoute = ParseRoute<TRouter['routeTree']>,
> = TRoute extends any
  ? PreValidationErrorHandlingRouteMatch<
      TRoute['id'],
      TRoute['fullPath'],
      TRoute['types']['allParams'],
      TRoute['types']['fullSearchSchema']
    >
  : never

export type MakeRouteMatchFromRoute<TRoute extends AnyRoute> = RouteMatch<
  TRoute['types']['id'],
  TRoute['types']['fullPath'],
  TRoute['types']['allParams'],
  TRoute['types']['fullSearchSchema'],
  TRoute['types']['loaderData'],
  TRoute['types']['allContext'],
  TRoute['types']['loaderDeps']
>

export type MakeRouteMatch<
  TRouteTree extends AnyRoute = RegisteredRouter['routeTree'],
  TRouteId = RouteIds<TRouteTree>,
  TStrict extends boolean = true,
> = RouteMatch<
  TRouteId,
  RouteById<TRouteTree, TRouteId>['types']['fullPath'],
  TStrict extends false
    ? AllParams<TRouteTree>
    : RouteById<TRouteTree, TRouteId>['types']['allParams'],
  TStrict extends false
    ? FullSearchSchema<TRouteTree>
    : RouteById<TRouteTree, TRouteId>['types']['fullSearchSchema'],
  TStrict extends false
    ? AllLoaderData<TRouteTree>
    : RouteById<TRouteTree, TRouteId>['types']['loaderData'],
  TStrict extends false
    ? AllContext<TRouteTree>
    : RouteById<TRouteTree, TRouteId>['types']['allContext'],
  RouteById<TRouteTree, TRouteId>['types']['loaderDeps']
>

export type AnyRouteMatch = RouteMatch<any, any, any, any, any, any, any>

export type MakeRouteMatchUnion<
  TRouter extends AnyRouter = RegisteredRouter,
  TRoute extends AnyRoute = ParseRoute<TRouter['routeTree']>,
> = TRoute extends any
  ? RouteMatch<
      TRoute['id'],
      TRoute['fullPath'],
      TRoute['types']['allParams'],
      TRoute['types']['fullSearchSchema'],
      TRoute['types']['loaderData'],
      TRoute['types']['allContext'],
      TRoute['types']['loaderDeps']
    >
  : never

/**
 * The `MatchRouteOptions` type is used to describe the options that can be used when matching a route.
 *
 * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/MatchRouteOptionsType#matchrouteoptions-type)
 */
export interface MatchRouteOptions {
  /**
   * If `true`, will match against pending location instead of the current location.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/MatchRouteOptionsType#pending-property)
   */
  pending?: boolean
  /**
   * If `true`, will match against the current location with case sensitivity.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/MatchRouteOptionsType#casesensitive-property)
   *
   * @deprecated Declare case sensitivity in the route definition instead, or globally for all routes using the `caseSensitive` option on the router.
   */
  caseSensitive?: boolean
  /**
   * If `true`, will match against the current location's search params using a deep inclusive check. e.g. `{ a: 1 }` will match for a current location of `{ a: 1, b: 2 }`.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/MatchRouteOptionsType#includesearch-property)
   */
  includeSearch?: boolean
  /**
   * If `true`, will match against the current location using a fuzzy match. e.g. `/posts` will match for a current location of `/posts/123`.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/MatchRouteOptionsType#fuzzy-property)
   */
  fuzzy?: boolean
}
