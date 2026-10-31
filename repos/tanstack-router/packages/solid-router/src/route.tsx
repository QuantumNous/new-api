import {
  BaseRootRoute,
  BaseRoute,
  BaseRouteApi,
  notFound,
} from '@tanstack/router-core'
import { Link } from './link'
import { useLoaderData } from './useLoaderData'
import { useLoaderDeps } from './useLoaderDeps'
import { useParams } from './useParams'
import { useSearch } from './useSearch'
import { useNavigate } from './useNavigate'
import { useMatch } from './useMatch'
import { useRouteContext } from './useRouteContext'
import { useRouter } from './useRouter'
import type {
  AnyContext,
  AnyRoute,
  AnyRouter,
  ConstrainLiteral,
  ErrorComponentProps,
  NotFoundError,
  NotFoundRouteProps,
  Register,
  RegisteredRouter,
  ResolveFullPath,
  ResolveId,
  ResolveParams,
  RootRoute as RootRouteCore,
  RootRouteId,
  RootRouteOptions,
  RouteConstraints,
  Route as RouteCore,
  RouteIds,
  RouteMask,
  RouteOptions,
  RouteTypesById,
  RouterCore,
  ToMaskOptions,
  UseNavigateResult,
} from '@tanstack/router-core'
import type { UseLoaderDataRoute } from './useLoaderData'
import type { UseMatchRoute } from './useMatch'
import type { UseLoaderDepsRoute } from './useLoaderDeps'
import type { UseParamsRoute } from './useParams'
import type { UseSearchRoute } from './useSearch'
import type * as Solid from 'solid-js'
import type { UseRouteContextRoute } from './useRouteContext'
import type { LinkComponentRoute } from './link'

declare module '@tanstack/router-core' {
  export interface UpdatableRouteOptionsExtensions {
    component?: RouteComponent
    errorComponent?: false | null | undefined | ErrorRouteComponent
    notFoundComponent?: NotFoundRouteComponent
    pendingComponent?: RouteComponent
  }

  export interface RootRouteOptionsExtensions {
    shellComponent?: ({
      children,
    }: {
      children: Solid.JSX.Element
    }) => Solid.JSX.Element
  }

  export interface RouteExtensions<
    in out TId extends string,
    in out TFullPath extends string,
  > {
    useMatch: UseMatchRoute<TId>
    useRouteContext: UseRouteContextRoute<TId>
    useSearch: UseSearchRoute<TId>
    useParams: UseParamsRoute<TId>
    useLoaderDeps: UseLoaderDepsRoute<TId>
    useLoaderData: UseLoaderDataRoute<TId>
    useNavigate: () => UseNavigateResult<TFullPath>
    Link: LinkComponentRoute<TFullPath>
  }
}

export function getRouteApi<
  const TId,
  TRouter extends AnyRouter = RegisteredRouter,
>(id: ConstrainLiteral<TId, RouteIds<TRouter['routeTree']>>) {
  return new RouteApi<TId, TRouter>({ id })
}

export class RouteApi<
  TId,
  TRouter extends AnyRouter = RegisteredRouter,
> extends BaseRouteApi<TId, TRouter> {
  /**
   * @deprecated Use the `getRouteApi` function instead.
   */
  constructor({ id }: { id: TId }) {
    super({ id })
  }

  useMatch: UseMatchRoute<TId> = (opts) => {
    return useMatch({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useRouteContext: UseRouteContextRoute<TId> = (opts) => {
    return useRouteContext({ ...(opts as any), from: this.id })
  }

  useSearch: UseSearchRoute<TId> = (opts) => {
    return useSearch({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useParams: UseParamsRoute<TId> = (opts) => {
    return useParams({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useLoaderDeps: UseLoaderDepsRoute<TId> = (opts) => {
    return useLoaderDeps({ ...opts, from: this.id, strict: false } as any)
  }

  useLoaderData: UseLoaderDataRoute<TId> = (opts) => {
    return useLoaderData({ ...opts, from: this.id, strict: false } as any)
  }

  useNavigate = (): UseNavigateResult<
    RouteTypesById<TRouter, TId>['fullPath']
  > => {
    const router = useRouter()
    return useNavigate({ from: router.routesById[this.id as string].fullPath })
  }

  notFound = (opts?: NotFoundError) => {
    return notFound({ routeId: this.id as string, ...opts })
  }

  Link: LinkComponentRoute<RouteTypesById<TRouter, TId>['fullPath']> = ((
    props,
  ) => {
    const router = useRouter()
    const fullPath = router.routesById[this.id as string].fullPath
    return <Link from={fullPath as never} {...props} />
  }) as LinkComponentRoute<RouteTypesById<TRouter, TId>['fullPath']>
}

export class Route<
  in out TRegister = unknown,
  in out TParentRoute extends RouteConstraints['TParentRoute'] = AnyRoute,
  in out TPath extends RouteConstraints['TPath'] = '/',
  in out TFullPath extends RouteConstraints['TFullPath'] = ResolveFullPath<
    TParentRoute,
    TPath
  >,
  in out TCustomId extends RouteConstraints['TCustomId'] = string,
  in out TId extends RouteConstraints['TId'] = ResolveId<
    TParentRoute,
    TCustomId,
    TPath
  >,
  in out TSearchValidator = undefined,
  in out TParams = ResolveParams<TPath>,
  in out TRouterContext = AnyContext,
  in out TRouteContextFn = AnyContext,
  in out TBeforeLoadFn = AnyContext,
  in out TLoaderDeps extends Record<string, any> = {},
  in out TLoaderFn = undefined,
  in out TChildren = unknown,
  in out TFileRouteTypes = unknown,
  in out TSSR = unknown,
  in out TMiddlewares = unknown,
  in out THandlers = undefined,
>
  extends BaseRoute<
    TRegister,
    TParentRoute,
    TPath,
    TFullPath,
    TCustomId,
    TId,
    TSearchValidator,
    TParams,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TLoaderDeps,
    TLoaderFn,
    TChildren,
    TFileRouteTypes,
    TSSR,
    TMiddlewares,
    THandlers
  >
  implements
    RouteCore<
      TRegister,
      TParentRoute,
      TPath,
      TFullPath,
      TCustomId,
      TId,
      TSearchValidator,
      TParams,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps,
      TLoaderFn,
      TChildren,
      TFileRouteTypes,
      TSSR,
      TMiddlewares,
      THandlers
    >
{
  /**
   * @deprecated Use the `createRoute` function instead.
   */
  constructor(
    options?: RouteOptions<
      TRegister,
      TParentRoute,
      TId,
      TCustomId,
      TFullPath,
      TPath,
      TSearchValidator,
      TParams,
      TLoaderDeps,
      TLoaderFn,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TSSR,
      TMiddlewares,
      THandlers
    >,
  ) {
    super(options)
  }

  useMatch: UseMatchRoute<TId> = (opts) => {
    return useMatch({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useRouteContext: UseRouteContextRoute<TId> = (opts?) => {
    return useRouteContext({ ...(opts as any), from: this.id }) as any
  }

  useSearch: UseSearchRoute<TId> = (opts) => {
    return useSearch({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useParams: UseParamsRoute<TId> = (opts) => {
    return useParams({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useLoaderDeps: UseLoaderDepsRoute<TId> = (opts) => {
    return useLoaderDeps({ ...opts, from: this.id } as any)
  }

  useLoaderData: UseLoaderDataRoute<TId> = (opts) => {
    return useLoaderData({ ...opts, from: this.id } as any)
  }

  useNavigate = (): UseNavigateResult<TFullPath> => {
    return useNavigate({ from: this.fullPath })
  }

  Link: LinkComponentRoute<TFullPath> = ((props) => {
    return <Link from={this.fullPath} {...props} />
  }) as LinkComponentRoute<TFullPath>
}

export function createRoute<
  TRegister = unknown,
  TParentRoute extends RouteConstraints['TParentRoute'] = AnyRoute,
  TPath extends RouteConstraints['TPath'] = '/',
  TFullPath extends RouteConstraints['TFullPath'] = ResolveFullPath<
    TParentRoute,
    TPath
  >,
  TCustomId extends RouteConstraints['TCustomId'] = string,
  TId extends RouteConstraints['TId'] = ResolveId<
    TParentRoute,
    TCustomId,
    TPath
  >,
  TSearchValidator = undefined,
  TParams = ResolveParams<TPath>,
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TChildren = unknown,
  TSSR = unknown,
  THandlers = undefined,
>(
  options: RouteOptions<
    TRegister,
    TParentRoute,
    TId,
    TCustomId,
    TFullPath,
    TPath,
    TSearchValidator,
    TParams,
    TLoaderDeps,
    TLoaderFn,
    AnyContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TSSR,
    THandlers
  >,
): Route<
  TRegister,
  TParentRoute,
  TPath,
  TFullPath,
  TCustomId,
  TId,
  TSearchValidator,
  TParams,
  AnyContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  TChildren,
  unknown,
  TSSR,
  THandlers
> {
  return new Route<
    TRegister,
    TParentRoute,
    TPath,
    TFullPath,
    TCustomId,
    TId,
    TSearchValidator,
    TParams,
    AnyContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TLoaderDeps,
    TLoaderFn,
    TChildren,
    unknown,
    TSSR,
    THandlers
  >(options)
}

export type AnyRootRoute = RootRoute<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export function createRootRouteWithContext<TRouterContext extends {}>() {
  return <
    TRegister = Register,
    TRouteContextFn = AnyContext,
    TBeforeLoadFn = AnyContext,
    TSearchValidator = undefined,
    TLoaderDeps extends Record<string, any> = {},
    TLoaderFn = undefined,
    TSSR = unknown,
    THandlers = undefined,
  >(
    options?: RootRouteOptions<
      TRegister,
      TSearchValidator,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps,
      TLoaderFn,
      TSSR,
      THandlers
    >,
  ) => {
    return createRootRoute<
      TRegister,
      TSearchValidator,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps,
      TLoaderFn,
      TSSR,
      THandlers
    >(options)
  }
}

/**
 * @deprecated Use the `createRootRouteWithContext` function instead.
 */
export const rootRouteWithContext = createRootRouteWithContext

export class RootRoute<
  in out TRegister = Register,
  in out TSearchValidator = undefined,
  in out TRouterContext = {},
  in out TRouteContextFn = AnyContext,
  in out TBeforeLoadFn = AnyContext,
  in out TLoaderDeps extends Record<string, any> = {},
  in out TLoaderFn = undefined,
  in out TChildren = unknown,
  in out TFileRouteTypes = unknown,
  in out TSSR = unknown,
  in out THandlers = undefined,
>
  extends BaseRootRoute<
    TRegister,
    TSearchValidator,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TLoaderDeps,
    TLoaderFn,
    TChildren,
    TFileRouteTypes,
    TSSR,
    THandlers
  >
  implements
    RootRouteCore<
      TRegister,
      TSearchValidator,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps,
      TLoaderFn,
      TChildren,
      TFileRouteTypes,
      TSSR,
      THandlers
    >
{
  /**
   * @deprecated `RootRoute` is now an internal implementation detail. Use `createRootRoute()` instead.
   */
  constructor(
    options?: RootRouteOptions<
      TRegister,
      TSearchValidator,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps,
      TLoaderFn,
      TSSR,
      THandlers
    >,
  ) {
    super(options)
  }

  useMatch: UseMatchRoute<RootRouteId> = (opts) => {
    return useMatch({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useRouteContext: UseRouteContextRoute<RootRouteId> = (opts) => {
    return useRouteContext({ ...(opts as any), from: this.id })
  }

  useSearch: UseSearchRoute<RootRouteId> = (opts) => {
    return useSearch({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useParams: UseParamsRoute<RootRouteId> = (opts) => {
    return useParams({
      select: opts?.select,
      from: this.id,
    } as any) as any
  }

  useLoaderDeps: UseLoaderDepsRoute<RootRouteId> = (opts) => {
    return useLoaderDeps({ ...opts, from: this.id } as any)
  }

  useLoaderData: UseLoaderDataRoute<RootRouteId> = (opts) => {
    return useLoaderData({ ...opts, from: this.id } as any)
  }

  useNavigate = (): UseNavigateResult<'/'> => {
    return useNavigate({ from: this.fullPath })
  }

  Link: LinkComponentRoute<'/'> = ((props) => {
    return <Link from={this.fullPath} {...(props as any)} />
  }) as LinkComponentRoute<'/'>
}

export function createRouteMask<
  TRouteTree extends AnyRoute,
  TFrom extends string,
  TTo extends string,
>(
  opts: {
    routeTree: TRouteTree
  } & ToMaskOptions<RouterCore<TRouteTree, 'never', false>, TFrom, TTo>,
): RouteMask<TRouteTree> {
  return opts as any
}

export type SolidNode = Solid.JSX.Element

export interface DefaultRouteTypes<TProps> {
  component: (props: TProps) => any
}
export interface RouteTypes<TProps> extends DefaultRouteTypes<TProps> {}

export type AsyncRouteComponent<TProps> = RouteTypes<TProps>['component'] & {
  preload?: () => Promise<void>
}

export type RouteComponent = AsyncRouteComponent<{}>

export type ErrorRouteComponent = AsyncRouteComponent<ErrorComponentProps>

export type NotFoundRouteComponent = RouteTypes<NotFoundRouteProps>['component']

export class NotFoundRoute<
  TRegister,
  TParentRoute extends AnyRootRoute,
  TRouterContext = AnyContext,
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TSearchValidator = undefined,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TChildren = unknown,
  TSSR = unknown,
  THandlers = undefined,
> extends Route<
  TRegister,
  TParentRoute,
  '/404',
  '/404',
  '404',
  '404',
  TSearchValidator,
  {},
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  TChildren,
  TSSR,
  THandlers
> {
  constructor(
    options: Omit<
      RouteOptions<
        TRegister,
        TParentRoute,
        string,
        string,
        string,
        string,
        TSearchValidator,
        {},
        TLoaderDeps,
        TLoaderFn,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn,
        TSSR,
        THandlers
      >,
      | 'caseSensitive'
      | 'parseParams'
      | 'stringifyParams'
      | 'path'
      | 'id'
      | 'params'
    >,
  ) {
    super({
      ...(options as any),
      id: '404',
    })
  }
}

export function createRootRoute<
  TRegister = Register,
  TSearchValidator = undefined,
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TSSR = unknown,
  THandlers = undefined,
>(
  options?: RootRouteOptions<
    TRegister,
    TSearchValidator,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TLoaderDeps,
    TLoaderFn,
    TSSR,
    THandlers
  >,
): RootRoute<
  TRegister,
  TSearchValidator,
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  unknown,
  unknown,
  TSSR,
  THandlers
> {
  return new RootRoute<
    TRegister,
    TSearchValidator,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TLoaderDeps,
    TLoaderFn,
    unknown,
    unknown,
    TSSR,
    THandlers
  >(options)
}
