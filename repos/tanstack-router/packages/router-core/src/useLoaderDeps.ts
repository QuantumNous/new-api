import type { RouteById } from './routeInfo'
import type { AnyRouter } from './router'
import type { Expand } from './utils'

export type ResolveUseLoaderDeps<TRouter extends AnyRouter, TFrom> = Expand<
  RouteById<TRouter['routeTree'], TFrom>['types']['loaderDeps']
>

export type UseLoaderDepsResult<
  TRouter extends AnyRouter,
  TFrom,
  TSelected,
> = unknown extends TSelected ? ResolveUseLoaderDeps<TRouter, TFrom> : TSelected
