import type { NavigateOptions, ToOptions } from './link'
import type { ParsedLocation } from './location'
import type { RoutePaths } from './routeInfo'
import type { RegisteredRouter, ViewTransitionOptions } from './router'

export interface MatchLocation {
  to?: string | number | null
  fuzzy?: boolean
  caseSensitive?: boolean
  from?: string
}

export interface CommitLocationOptions {
  replace?: boolean
  resetScroll?: boolean
  hashScrollIntoView?: boolean | ScrollIntoViewOptions
  viewTransition?: boolean | ViewTransitionOptions
  /**
   * @deprecated All navigations use transitions under the hood now
   **/
  startTransition?: boolean
  ignoreBlocker?: boolean
}

export type NavigateFn = <
  TRouter extends RegisteredRouter,
  TTo extends string | undefined,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '',
>(
  opts: NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
) => Promise<void>

export type BuildLocationFn = <
  TRouter extends RegisteredRouter,
  TTo extends string | undefined,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '',
>(
  opts: ToOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
    leaveParams?: boolean
    _includeValidateSearch?: boolean
    _isNavigate?: boolean
  },
) => ParsedLocation
