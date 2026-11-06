import type {
  AnyContext,
  AnyRoute,
  Assign,
  Constrain,
  Expand,
  ResolveAllParamsFromParent,
  UnionToIntersection,
} from '@tanstack/router-core'
import type {
  AnyRequestMiddleware,
  AssignAllServerRequestContext,
} from './createMiddleware'

declare module '@tanstack/router-core' {
  interface FilebaseRouteOptionsInterface<
    TRegister,
    TParentRoute extends AnyRoute = AnyRoute,
    TId extends string = string,
    TPath extends string = string,
    TSearchValidator = undefined,
    TParams = {},
    TLoaderDeps extends Record<string, any> = {},
    TLoaderFn = undefined,
    TRouterContext = {},
    TRouteContextFn = AnyContext,
    TBeforeLoadFn = AnyContext,
    TRemountDepsFn = AnyContext,
    TSSR = unknown,
    TServerMiddlewares = unknown,
    THandlers = undefined,
  > {
    server?: RouteServerOptions<
      TRegister,
      TParentRoute,
      TPath,
      TParams,
      TLoaderDeps,
      TLoaderFn,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TServerMiddlewares,
      THandlers
    >
  }

  interface RouteTypes<
    in out TRegister,
    in out TParentRoute extends AnyRoute,
    in out TPath extends string,
    in out TFullPath extends string,
    in out TCustomId extends string,
    in out TId extends string,
    in out TSearchValidator,
    in out TParams,
    in out TRouterContext,
    in out TRouteContextFn,
    in out TBeforeLoadFn,
    in out TLoaderDeps,
    in out TLoaderFn,
    in out TChildren,
    in out TFileRouteTypes,
    in out TSSR,
    in out TServerMiddlewares,
    in out THandlers,
  > {
    middleware: TServerMiddlewares
    allServerContext: ResolveAllServerContext<
      TRegister,
      TParentRoute,
      TServerMiddlewares
    >
  }

  interface BeforeLoadContextOptions<
    in out TRegister,
    in out TParentRoute extends AnyRoute,
    in out TSearchValidator,
    in out TParams,
    in out TRouterContext,
    in out TRouteContextFn,
    in out TRouteId,
    in out TServerMiddlewares,
    in out THandlers,
  > {
    serverContext?: Expand<
      Assign<
        ResolveAllServerContext<TRegister, TParentRoute, TServerMiddlewares>,
        ExtractHandlersContext<THandlers>
      >
    >
  }

  interface LoaderFnContext<
    in out TRegister,
    in out TParentRoute extends AnyRoute = AnyRoute,
    in out TId extends string = string,
    in out TParams = {},
    in out TLoaderDeps = {},
    in out TRouterContext = {},
    in out TRouteContextFn = AnyContext,
    in out TBeforeLoadFn = AnyContext,
    in out TServerMiddlewares = unknown,
    in out THandlers = undefined,
  > {
    serverContext?: Expand<
      Assign<
        ResolveAllServerContext<TRegister, TParentRoute, TServerMiddlewares>,
        ExtractHandlersContext<THandlers>
      >
    >
  }
}

type ExtractHandlersContext<THandlers> = THandlers extends (
  ...args: any
) => CustomHandlerFunctionsRecord<
  any,
  any,
  any,
  any,
  any,
  any,
  infer TServerContext
>
  ? UnionToIntersection<TServerContext>
  : THandlers extends Record<
        string,
        RouteMethodHandler<any, any, any, any, any, any, infer TServerContext>
      >
    ? UnionToIntersection<TServerContext>
    : undefined

export interface RouteServerOptions<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TLoaderDeps,
  TLoaderFn,
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TServerMiddlewares,
  THandlers,
> {
  middleware?: Constrain<
    TServerMiddlewares,
    ReadonlyArray<AnyRequestMiddleware>
  >

  handlers?: Constrain<
    THandlers,
    | Partial<
        Record<
          RouteMethod,
          RouteMethodHandlerFn<
            TRegister,
            TParentRoute,
            TFullPath,
            TParams,
            TServerMiddlewares,
            any,
            any
          >
        >
      >
    | ((
        opts: HandlersFnOpts<
          TRegister,
          TParentRoute,
          TFullPath,
          TParams,
          TServerMiddlewares
        >,
      ) => CustomHandlerFunctionsRecord<
        TRegister,
        TParentRoute,
        TFullPath,
        TParams,
        TServerMiddlewares,
        any,
        any
      >)
  >
}

declare const createHandlersSymbol: unique symbol

type CustomHandlerFunctionsRecord<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
  TMethodMiddlewares,
  TServerContext,
> = {
  [createHandlersSymbol]: true
} & Partial<
  Record<
    RouteMethod,
    RouteMethodHandler<
      TRegister,
      TParentRoute,
      TFullPath,
      TParams,
      TServerMiddlewares,
      TMethodMiddlewares,
      TServerContext
    >
  >
>

export interface HandlersFnOpts<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
> {
  createHandlers: CreateHandlersFn<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares
  >
}

export type CreateHandlersFn<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
> = <
  const TMethodAllMiddlewares,
  const TMethodGetMiddlewares,
  const TMethodPostMiddlewares,
  const TMethodPutMiddlewares,
  const TMethodPatchMiddlewares,
  const TMethodDeleteMiddlewares,
  const TMethodOptionsMiddlewares,
  const TMethodHeadMiddlewares,
  TServerContext,
>(
  opts: CreateMethodFnOpts<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodAllMiddlewares,
    TMethodGetMiddlewares,
    TMethodPostMiddlewares,
    TMethodPutMiddlewares,
    TMethodPatchMiddlewares,
    TMethodDeleteMiddlewares,
    TMethodOptionsMiddlewares,
    TMethodHeadMiddlewares,
    TServerContext
  >,
) => CustomHandlerFunctionsRecord<
  TRegister,
  TParentRoute,
  TFullPath,
  TParams,
  TServerMiddlewares,
  any,
  TServerContext
>

export interface CreateMethodFnOpts<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
  TMethodAllMiddlewares,
  TMethodGetMiddlewares,
  TMethodPostMiddlewares,
  TMethodPutMiddlewares,
  TMethodPatchMiddlewares,
  TMethodDeleteMiddlewares,
  TMethodOptionsMiddlewares,
  TMethodHeadMiddlewares,
  TServerContext,
> {
  ANY?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodAllMiddlewares,
    TServerContext
  >
  GET?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodGetMiddlewares,
    TServerContext
  >
  POST?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodPostMiddlewares,
    TServerContext
  >
  PUT?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodPutMiddlewares,
    TServerContext
  >
  PATCH?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodPatchMiddlewares,
    TServerContext
  >
  DELETE?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodDeleteMiddlewares,
    TServerContext
  >
  OPTIONS?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodOptionsMiddlewares,
    TServerContext
  >
  HEAD?: RouteMethodHandler<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodHeadMiddlewares,
    TServerContext
  >
}

export type RouteMethodHandler<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
  TMethodMiddlewares,
  TServerContext,
> =
  | RouteMethodHandlerFn<
      TRegister,
      TParentRoute,
      TFullPath,
      TParams,
      TServerMiddlewares,
      TMethodMiddlewares,
      TServerContext
    >
  | RouteMethodBuilderOptions<
      TRegister,
      TParentRoute,
      TFullPath,
      TParams,
      TServerMiddlewares,
      TMethodMiddlewares,
      TServerContext
    >

export interface RouteMethodBuilderOptions<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
  TMethodMiddlewares,
  TResponse,
> {
  handler?: RouteMethodHandlerFn<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodMiddlewares,
    TResponse
  >
  middleware?: Constrain<
    TMethodMiddlewares,
    ReadonlyArray<AnyRequestMiddleware>
  >
}

export type ResolveAllServerContext<
  TRegister,
  TParentRoute extends AnyRoute,
  TServerMiddlewares,
> = unknown extends TParentRoute
  ? AssignAllServerRequestContext<TRegister, TServerMiddlewares, {}>
  : Assign<
      TParentRoute['types']['allServerContext'],
      AssignAllServerRequestContext<TRegister, TServerMiddlewares, {}>
    >

export type RouteMethod =
  | 'ANY'
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'

export type RouteMethodHandlerFn<
  TRegister,
  TParentRoute extends AnyRoute,
  TFullPath extends string,
  TParams,
  TServerMiddlewares,
  TMethodMiddlewares,
  TServerContext,
> = (
  ctx: RouteMethodHandlerCtx<
    TRegister,
    TParentRoute,
    TFullPath,
    TParams,
    TServerMiddlewares,
    TMethodMiddlewares
  >,
) =>
  | RouteMethodResult<TServerContext>
  | Promise<RouteMethodResult<TServerContext>>

export type RouteMethodResult<TContext> =
  | Response
  | undefined
  | RouteMethodNextResult<TContext>

export type RouteMethodNextResult<TContext> = {
  isNext: true
  context: TContext
}

export interface RouteMethodHandlerCtx<
  in out TRegister,
  in out TParentRoute extends AnyRoute,
  in out TFullPath extends string,
  in out TParams,
  in out TServerMiddlewares,
  in out TMethodMiddlewares,
> {
  context: Expand<
    AssignAllMethodContext<
      TRegister,
      TParentRoute,
      TServerMiddlewares,
      TMethodMiddlewares
    >
  >
  request: Request
  params: Expand<ResolveAllParamsFromParent<TParentRoute, TParams>>
  pathname: TFullPath
  next: <TContext = undefined>(options?: {
    context?: TContext
  }) => RouteMethodNextResult<TContext>
}

export type MergeMethodMiddlewares<TServerMiddlewares, TMethodMiddlewares> =
  TServerMiddlewares extends ReadonlyArray<any>
    ? TMethodMiddlewares extends ReadonlyArray<any>
      ? readonly [...TServerMiddlewares, ...TMethodMiddlewares]
      : TServerMiddlewares
    : TMethodMiddlewares

export type AssignAllMethodContext<
  TRegister,
  TParentRoute extends AnyRoute,
  TServerMiddlewares,
  TMethodMiddlewares,
> = ResolveAllServerContext<
  TRegister,
  TParentRoute,
  MergeMethodMiddlewares<TServerMiddlewares, TMethodMiddlewares>
>
