import {
  BaseRootRoute,
  BaseRoute,
  BaseRouteApi,
  notFound,
} from '@tanstack/router-core'
import React from 'react'
import { useLoaderData } from './useLoaderData'
import { useLoaderDeps } from './useLoaderDeps'
import { useParams } from './useParams'
import { useSearch } from './useSearch'
import { useNavigate } from './useNavigate'
import { useMatch } from './useMatch'
import { useRouteContext } from './useRouteContext'
import { useRouter } from './useRouter'
import { Link } from './link'
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
      children: React.ReactNode
    }) => React.ReactNode
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

/**
 * Returns a route-specific API that exposes type-safe hooks pre-bound
 * to a single route ID. Useful for consuming a route's APIs from files
 * where the route object isn't directly imported (e.g. code-split files).
 *
 * @param id Route ID string literal for the target route.
 * @returns A `RouteApi` instance bound to the given route ID.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/getRouteApiFunction
 */
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
      structuralSharing: opts?.structuralSharing,
    } as any) as any
  }

  useRouteContext: UseRouteContextRoute<TId> = (opts) => {
    return useRouteContext({ ...(opts as any), from: this.id })
  }

  useSearch: UseSearchRoute<TId> = (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return useSearch({
      select: opts?.select,
      structuralSharing: opts?.structuralSharing,
      from: this.id,
    } as any) as any
  }

  useParams: UseParamsRoute<TId> = (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return useParams({
      select: opts?.select,
      structuralSharing: opts?.structuralSharing,
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

  Link: LinkComponentRoute<RouteTypesById<TRouter, TId>['fullPath']> =
    React.forwardRef((props, ref: React.ForwardedRef<HTMLAnchorElement>) => {
      const router = useRouter()
      const fullPath = router.routesById[this.id as string].fullPath
      return <Link ref={ref} from={fullPath as never} {...props} />
    }) as unknown as LinkComponentRoute<
      RouteTypesById<TRouter, TId>['fullPath']
    >
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
  in out TServerMiddlewares = unknown,
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
    TServerMiddlewares,
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
      TServerMiddlewares,
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
      TServerMiddlewares,
      THandlers
    >,
  ) {
    super(options)
  }

  useMatch: UseMatchRoute<TId> = (opts) => {
    return useMatch({
      select: opts?.select,
      from: this.id,
      structuralSharing: opts?.structuralSharing,
    } as any) as any
  }

  useRouteContext: UseRouteContextRoute<TId> = (opts?) => {
    return useRouteContext({ ...(opts as any), from: this.id })
  }

  useSearch: UseSearchRoute<TId> = (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return useSearch({
      select: opts?.select,
      structuralSharing: opts?.structuralSharing,
      from: this.id,
    } as any) as any
  }

  useParams: UseParamsRoute<TId> = (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return useParams({
      select: opts?.select,
      structuralSharing: opts?.structuralSharing,
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

  Link: LinkComponentRoute<TFullPath> = React.forwardRef(
    (props, ref: React.ForwardedRef<HTMLAnchorElement>) => {
      return <Link ref={ref} from={this.fullPath as never} {...props} />
    },
  ) as unknown as LinkComponentRoute<TFullPath>
}

/**
 * Creates a non-root Route instance for code-based routing.
 *
 * Use this to define a route that will be composed into a route tree
 * (typically via a parent route's `addChildren`). If you're using file-based
 * routing, prefer `createFileRoute`.
 *
 * @param options Route options (path, component, loader, context, etc.).
 * @returns A Route instance to be attached to the route tree.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRouteFunction
 */
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
  const TServerMiddlewares = unknown,
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
    TServerMiddlewares
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
  TSSR,
  TServerMiddlewares
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
    TSSR,
    TServerMiddlewares
  >(
    // TODO: Help us TypeChris, you're our only hope!
    options as any,
  )
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
  any,
  any
>

/**
 * Creates a root route factory that requires a router context type.
 *
 * Use when your root route expects `context` to be provided to `createRouter`.
 * The returned function behaves like `createRootRoute` but enforces a context type.
 *
 * @returns A factory function to configure and return a root route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRootRouteWithContextFunction
 */
export function createRootRouteWithContext<TRouterContext extends {}>() {
  return <
    TRegister = Register,
    TRouteContextFn = AnyContext,
    TBeforeLoadFn = AnyContext,
    TSearchValidator = undefined,
    TLoaderDeps extends Record<string, any> = {},
    TLoaderFn = undefined,
    TSSR = unknown,
    TServerMiddlewares = unknown,
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
      TServerMiddlewares
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
      TServerMiddlewares
    >(options)
  }
}

/**
 * @deprecated Use the `createRootRouteWithContext` function instead.
 */
export const rootRouteWithContext = createRootRouteWithContext

export class RootRoute<
  in out TRegister = unknown,
  in out TSearchValidator = undefined,
  in out TRouterContext = {},
  in out TRouteContextFn = AnyContext,
  in out TBeforeLoadFn = AnyContext,
  in out TLoaderDeps extends Record<string, any> = {},
  in out TLoaderFn = undefined,
  in out TChildren = unknown,
  in out TFileRouteTypes = unknown,
  in out TSSR = unknown,
  in out TServerMiddlewares = unknown,
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
    TServerMiddlewares,
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
      TServerMiddlewares,
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
      TServerMiddlewares,
      THandlers
    >,
  ) {
    super(options)
  }

  useMatch: UseMatchRoute<RootRouteId> = (opts) => {
    return useMatch({
      select: opts?.select,
      from: this.id,
      structuralSharing: opts?.structuralSharing,
    } as any) as any
  }

  useRouteContext: UseRouteContextRoute<RootRouteId> = (opts) => {
    return useRouteContext({ ...(opts as any), from: this.id })
  }

  useSearch: UseSearchRoute<RootRouteId> = (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return useSearch({
      select: opts?.select,
      structuralSharing: opts?.structuralSharing,
      from: this.id,
    } as any) as any
  }

  useParams: UseParamsRoute<RootRouteId> = (opts) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return useParams({
      select: opts?.select,
      structuralSharing: opts?.structuralSharing,
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

  Link: LinkComponentRoute<'/'> = React.forwardRef(
    (props, ref: React.ForwardedRef<HTMLAnchorElement>) => {
      return <Link ref={ref} from={this.fullPath} {...props} />
    },
  ) as unknown as LinkComponentRoute<'/'>
}

/**
 * Creates a root Route instance used to build your route tree.
 *
 * Typically paired with `createRouter({ routeTree })`. If you need to require
 * a typed router context, use `createRootRouteWithContext` instead.
 *
 * @param options Root route options (component, error, pending, etc.).
 * @returns A root route instance.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRootRouteFunction
 */
export function createRootRoute<
  TRegister = Register,
  TSearchValidator = undefined,
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TSSR = unknown,
  const TServerMiddlewares = unknown,
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
    TServerMiddlewares,
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
  TServerMiddlewares,
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
    TServerMiddlewares,
    THandlers
  >(options)
}

export function createRouteMask<
  TRouteTree extends AnyRoute,
  TFrom extends string,
  TTo extends string,
>(
  opts: {
    routeTree: TRouteTree
  } & ToMaskOptions<RouterCore<TRouteTree, 'never', boolean>, TFrom, TTo>,
): RouteMask<TRouteTree> {
  return opts as any
}

export interface DefaultRouteTypes<TProps> {
  component:
    | ((props: TProps) => any)
    | React.LazyExoticComponent<(props: TProps) => any>
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
  TServerMiddlewares = unknown,
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
  TServerMiddlewares
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
        TServerMiddlewares
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
