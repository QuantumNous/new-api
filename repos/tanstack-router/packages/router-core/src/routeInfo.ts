import type { InferFileRouteTypes } from './fileRoute'
import type { AddTrailingSlash, RemoveTrailingSlashes } from './link'
import type { AnyRoute } from './route'
import type { AnyRouter, TrailingSlashOption } from './router'
import type { PartialMergeAll } from './utils'

export type ParseRoute<TRouteTree, TAcc = TRouteTree> = TRouteTree extends {
  types: { children: infer TChildren }
}
  ? unknown extends TChildren
    ? TAcc
    : TChildren extends ReadonlyArray<any>
      ? ParseRoute<TChildren[number], TAcc | TChildren[number]>
      : ParseRoute<
          TChildren[keyof TChildren],
          TAcc | TChildren[keyof TChildren]
        >
  : TAcc

export type ParseRouteWithoutBranches<TRouteTree> =
  ParseRoute<TRouteTree> extends infer TRoute extends AnyRoute
    ? TRoute extends any
      ? unknown extends TRoute['types']['children']
        ? TRoute
        : TRoute['types']['children'] extends ReadonlyArray<any>
          ? '/' extends TRoute['types']['children'][number]['path']
            ? never
            : TRoute
          : '/' extends TRoute['types']['children'][keyof TRoute['types']['children']]['path']
            ? never
            : TRoute
      : never
    : never

export type CodeRoutesById<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? {
        [K in TRoutes as K['id']]: K
      }
    : never

export type RoutesById<TRouteTree extends AnyRoute> =
  InferFileRouteTypes<TRouteTree> extends never
    ? CodeRoutesById<TRouteTree>
    : InferFileRouteTypes<TRouteTree>['fileRoutesById']

export type RouteById<TRouteTree extends AnyRoute, TId> = Extract<
  RoutesById<TRouteTree>[TId & keyof RoutesById<TRouteTree>],
  AnyRoute
>

export type CodeRouteIds<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? TRoutes['id']
    : never

export type RouteIds<TRouteTree extends AnyRoute> =
  InferFileRouteTypes<TRouteTree> extends never
    ? CodeRouteIds<TRouteTree>
    : InferFileRouteTypes<TRouteTree>['id']

export type ParentPath<TRouter extends AnyRouter> =
  TrailingSlashOptionByRouter<TRouter> extends 'always'
    ? '../'
    : TrailingSlashOptionByRouter<TRouter> extends 'never'
      ? '..'
      : '../' | '..'

export type CurrentPath<TRouter extends AnyRouter> =
  TrailingSlashOptionByRouter<TRouter> extends 'always'
    ? './'
    : TrailingSlashOptionByRouter<TRouter> extends 'never'
      ? '.'
      : './' | '.'

export type ToPath<TRouter extends AnyRouter, TTo extends string> =
  TrailingSlashOptionByRouter<TRouter> extends 'always'
    ? AddTrailingSlash<TTo>
    : TrailingSlashOptionByRouter<TRouter> extends 'never'
      ? RemoveTrailingSlashes<TTo>
      : AddTrailingSlash<TTo> | RemoveTrailingSlashes<TTo>

export type CatchAllPaths<TRouter extends AnyRouter> =
  | CurrentPath<TRouter>
  | ParentPath<TRouter>

export type CodeRoutesByPath<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? {
        [K in TRoutes as K['fullPath']]: K
      }
    : never

export type RoutesByPath<TRouteTree extends AnyRoute> =
  InferFileRouteTypes<TRouteTree> extends never
    ? CodeRoutesByPath<TRouteTree>
    : InferFileRouteTypes<TRouteTree>['fileRoutesByFullPath']

export type RouteByPath<TRouteTree extends AnyRoute, TPath> = Extract<
  RoutesByPath<TRouteTree>[TPath & keyof RoutesByPath<TRouteTree>],
  AnyRoute
>

export type CodeRoutePaths<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? TRoutes['fullPath']
    : never

export type RoutePaths<TRouteTree extends AnyRoute> = unknown extends TRouteTree
  ? string
  :
      | (InferFileRouteTypes<TRouteTree> extends never
          ? CodeRoutePaths<TRouteTree>
          : InferFileRouteTypes<TRouteTree>['fullPaths'])
      | '/'

export type RouteToPathAlwaysTrailingSlash<TRoute extends AnyRoute> =
  TRoute['path'] extends '/'
    ? TRoute['fullPath']
    : TRoute['fullPath'] extends '/'
      ? TRoute['fullPath']
      : `${TRoute['fullPath']}/`

export type RouteToPathNeverTrailingSlash<TRoute extends AnyRoute> =
  TRoute['path'] extends '/'
    ? TRoute['fullPath'] extends '/'
      ? TRoute['fullPath']
      : RemoveTrailingSlashes<TRoute['fullPath']>
    : TRoute['fullPath']

export type RouteToPathPreserveTrailingSlash<TRoute extends AnyRoute> =
  | RouteToPathNeverTrailingSlash<TRoute>
  | RouteToPathAlwaysTrailingSlash<TRoute>

export type RouteToPathByTrailingSlashOption<TRoute extends AnyRoute> = {
  always: RouteToPathAlwaysTrailingSlash<TRoute>
  preserve: RouteToPathPreserveTrailingSlash<TRoute>
  never: RouteToPathNeverTrailingSlash<TRoute>
}

export type TrailingSlashOptionByRouter<TRouter extends AnyRouter> =
  TrailingSlashOption extends TRouter['options']['trailingSlash']
    ? 'never'
    : NonNullable<TRouter['options']['trailingSlash']>

export type RouteToByRouter<
  TRouter extends AnyRouter,
  TRoute extends AnyRoute,
> = RouteToPathByTrailingSlashOption<TRoute>[TrailingSlashOptionByRouter<TRouter>]

export type CodeRouteToPath<TRouter extends AnyRouter> =
  ParseRouteWithoutBranches<TRouter['routeTree']> extends infer TRoute extends
    AnyRoute
    ? TRoute extends any
      ? RouteToByRouter<TRouter, TRoute>
      : never
    : never

export type FileRouteToPath<
  TRouter extends AnyRouter,
  TTo = InferFileRouteTypes<TRouter['routeTree']>['to'],
  TTrailingSlashOption = TrailingSlashOptionByRouter<TRouter>,
> = 'never' extends TTrailingSlashOption
  ? TTo
  : 'always' extends TTrailingSlashOption
    ? AddTrailingSlash<TTo>
    : TTo | AddTrailingSlash<TTo>

export type RouteToPath<TRouter extends AnyRouter> = unknown extends TRouter
  ? string
  : InferFileRouteTypes<TRouter['routeTree']> extends never
    ? CodeRouteToPath<TRouter>
    : FileRouteToPath<TRouter>

export type CodeRoutesByToPath<TRouter extends AnyRouter> =
  ParseRouteWithoutBranches<TRouter['routeTree']> extends infer TRoutes extends
    AnyRoute
    ? {
        [TRoute in TRoutes as RouteToByRouter<TRouter, TRoute>]: TRoute
      }
    : never

export type RoutesByToPath<TRouter extends AnyRouter> =
  InferFileRouteTypes<TRouter['routeTree']> extends never
    ? CodeRoutesByToPath<TRouter>
    : InferFileRouteTypes<TRouter['routeTree']>['fileRoutesByTo']

export type CodeRouteByToPath<TRouter extends AnyRouter, TTo> = Extract<
  RoutesByToPath<TRouter>[TTo & keyof RoutesByToPath<TRouter>],
  AnyRoute
>

export type FileRouteByToPath<TRouter extends AnyRouter, TTo> =
  'never' extends TrailingSlashOptionByRouter<TRouter>
    ? CodeRouteByToPath<TRouter, TTo>
    : 'always' extends TrailingSlashOptionByRouter<TRouter>
      ? TTo extends '/'
        ? CodeRouteByToPath<TRouter, TTo>
        : TTo extends `${infer TPath}/`
          ? CodeRouteByToPath<TRouter, TPath>
          : never
      : CodeRouteByToPath<
          TRouter,
          TTo extends '/' ? TTo : RemoveTrailingSlashes<TTo>
        >

export type RouteByToPath<TRouter extends AnyRouter, TTo> =
  InferFileRouteTypes<TRouter['routeTree']> extends never
    ? CodeRouteByToPath<TRouter, TTo>
    : FileRouteByToPath<TRouter, TTo>

export type FullSearchSchema<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? PartialMergeAll<TRoutes['types']['fullSearchSchema']>
    : never

export type FullSearchSchemaInput<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? PartialMergeAll<TRoutes['types']['fullSearchSchemaInput']>
    : never

export type AllParams<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? PartialMergeAll<TRoutes['types']['allParams']>
    : never

export type AllContext<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? PartialMergeAll<TRoutes['types']['allContext']>
    : never

export type AllLoaderData<TRouteTree extends AnyRoute> =
  ParseRoute<TRouteTree> extends infer TRoutes extends AnyRoute
    ? PartialMergeAll<TRoutes['types']['loaderData']>
    : never
