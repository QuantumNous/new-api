import type { AllParams, RouteById } from './routeInfo'
import type { AnyRouter } from './router'
import type { Expand } from './utils'

export type ResolveUseParams<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
> = TStrict extends false
  ? AllParams<TRouter['routeTree']>
  : Expand<RouteById<TRouter['routeTree'], TFrom>['types']['allParams']>

export type UseParamsResult<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TSelected,
> = unknown extends TSelected
  ? ResolveUseParams<TRouter, TFrom, TStrict>
  : TSelected
