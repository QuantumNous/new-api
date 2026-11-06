import type { AllContext, RouteById } from './routeInfo'
import type { AnyRouter } from './router'
import type { Expand, StrictOrFrom } from './utils'

export interface UseRouteContextBaseOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TSelected,
> {
  select?: (
    search: ResolveUseRouteContext<TRouter, TFrom, TStrict>,
  ) => TSelected
}

export type UseRouteContextOptions<
  TRouter extends AnyRouter,
  TFrom extends string | undefined,
  TStrict extends boolean,
  TSelected,
> = StrictOrFrom<TRouter, TFrom, TStrict> &
  UseRouteContextBaseOptions<TRouter, TFrom, TStrict, TSelected>

export type ResolveUseRouteContext<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
> = TStrict extends false
  ? AllContext<TRouter['routeTree']>
  : Expand<RouteById<TRouter['routeTree'], TFrom>['types']['allContext']>

export type UseRouteContextResult<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TSelected,
> = unknown extends TSelected
  ? ResolveUseRouteContext<TRouter, TFrom, TStrict>
  : TSelected
