import { invariant } from './invariant'
import { joinPaths, trimPathLeft, trimPathRight } from './path'
import { notFound } from './not-found'
import { redirect } from './redirect'
import { rootRouteId } from './root'
import type { LazyRoute } from './fileRoute'
import type { NotFoundError } from './not-found'
import type { RedirectFnRoute } from './redirect'
import type { NavigateOptions, ParsePathParams } from './link'
import type { ParsedLocation } from './location'
import type {
  AnyRouteMatch,
  MakePreValidationErrorHandlingRouteMatchUnion,
  MakeRouteMatchFromRoute,
  MakeRouteMatchUnion,
  RouteMatch,
} from './Matches'
import type { RootRouteId } from './root'
import type { ParseRoute, RouteById, RouteIds, RoutePaths } from './routeInfo'
import type { AnyRouter, Register, RegisteredRouter, SSROption } from './router'
import type { BuildLocationFn, NavigateFn } from './RouterProvider'
import type {
  Assign,
  Awaitable,
  Constrain,
  Expand,
  IntersectAssign,
  LooseAsyncReturnType,
  LooseReturnType,
  NoInfer,
} from './utils'
import type {
  AnySchema,
  AnyStandardSchemaValidator,
  AnyValidator,
  AnyValidatorAdapter,
  AnyValidatorObj,
  DefaultValidator,
  ResolveSearchValidatorInput,
  ResolveValidatorOutput,
  StandardSchemaValidator,
  ValidatorAdapter,
  ValidatorFn,
  ValidatorObj,
} from './validators'
import type { ValidateSerializableLifecycleResult } from './ssr/serializer/transformer'

export type AnyPathParams = {}

export type SearchSchemaInput = {
  __TSearchSchemaInput__: 'TSearchSchemaInput'
}

export type AnyContext = {}

export interface RouteContext {}

export type PreloadableObj = { preload?: () => Promise<void> }

export type RoutePathOptions<TCustomId, TPath> =
  | {
      path: TPath
    }
  | {
      id: TCustomId
    }

export interface StaticDataRouteOption {}

export type RoutePathOptionsIntersection<TCustomId, TPath> = {
  path: TPath
  id: TCustomId
}

export type SearchFilter<TInput, TResult = TInput> = (prev: TInput) => TResult

export type SearchMiddlewareMeta = {
  removed?: Map<string, unknown>
  removedAny?: Set<string>
  defaulted?: Map<string, unknown>
  explicit?: unknown
}

export type SearchMiddlewareContext<TSearchSchema> = {
  search: TSearchSchema
  next: (newSearch: TSearchSchema) => TSearchSchema
  meta?: SearchMiddlewareMeta
}

export type SearchMiddleware<TSearchSchema> = (
  ctx: SearchMiddlewareContext<TSearchSchema>,
) => TSearchSchema

export type ResolveId<
  TParentRoute,
  TCustomId extends string,
  TPath extends string,
> = TParentRoute extends { id: infer TParentId extends string }
  ? RoutePrefix<TParentId, string extends TCustomId ? TPath : TCustomId>
  : RootRouteId

export type InferFullSearchSchema<TRoute> = TRoute extends {
  types: {
    fullSearchSchema: infer TFullSearchSchema
  }
}
  ? TFullSearchSchema
  : {}

export type InferFullSearchSchemaInput<TRoute> = TRoute extends {
  types: {
    fullSearchSchemaInput: infer TFullSearchSchemaInput
  }
}
  ? TFullSearchSchemaInput
  : {}

export type InferAllParams<TRoute> = TRoute extends {
  types: {
    allParams: infer TAllParams
  }
}
  ? TAllParams
  : {}

export type InferAllContext<TRoute> = unknown extends TRoute
  ? TRoute
  : TRoute extends {
        types: {
          allContext: infer TAllContext
        }
      }
    ? TAllContext
    : {}

export type ResolveSearchSchemaFnInput<TSearchValidator> =
  TSearchValidator extends (input: infer TSearchSchemaInput) => any
    ? TSearchSchemaInput extends SearchSchemaInput
      ? Omit<TSearchSchemaInput, keyof SearchSchemaInput>
      : ResolveSearchSchemaFn<TSearchValidator>
    : AnySchema

export type ResolveSearchSchemaInput<TSearchValidator> =
  TSearchValidator extends AnyStandardSchemaValidator
    ? NonNullable<TSearchValidator['~standard']['types']>['input']
    : TSearchValidator extends AnyValidatorAdapter
      ? TSearchValidator['types']['input']
      : TSearchValidator extends AnyValidatorObj
        ? ResolveSearchSchemaFnInput<TSearchValidator['parse']>
        : ResolveSearchSchemaFnInput<TSearchValidator>

export type ResolveSearchSchemaFn<TSearchValidator> = TSearchValidator extends (
  ...args: any
) => infer TSearchSchema
  ? TSearchSchema
  : AnySchema

export type ResolveSearchSchema<TSearchValidator> =
  unknown extends TSearchValidator
    ? TSearchValidator
    : TSearchValidator extends AnyStandardSchemaValidator
      ? NonNullable<TSearchValidator['~standard']['types']>['output']
      : TSearchValidator extends AnyValidatorAdapter
        ? TSearchValidator['types']['output']
        : TSearchValidator extends AnyValidatorObj
          ? ResolveSearchSchemaFn<TSearchValidator['parse']>
          : ResolveSearchSchemaFn<TSearchValidator>

export type ResolveRequiredParams<TPath extends string, T> = {
  [K in ParsePathParams<TPath>['required']]: T
}

export type ResolveOptionalParams<TPath extends string, T> = {
  [K in ParsePathParams<TPath>['optional']]?: T | undefined
}

export type ResolveParams<
  TPath extends string,
  T = string,
> = ResolveRequiredParams<TPath, T> & ResolveOptionalParams<TPath, T>

export type ParseParamsFn<in out TPath extends string, in out TParams> = (
  rawParams: Expand<ResolveParams<TPath>>,
) => TParams | false

type ValidateParsedParams<TPath extends string, TParams> = [TParams] extends [
  ResolveParams<TPath, any>,
]
  ? unknown
  : never

export type StringifyParamsFn<in out TPath extends string, in out TParams> = (
  params: TParams,
) => ResolveParams<TPath>

export type ParamsOptions<in out TPath extends string, in out TParams> = {
  params?: {
    parse?: ParseParamsFn<TPath, TParams> & ValidateParsedParams<TPath, TParams>
    /**
     * When multiple route candidates use `params.parse` during matching,
     * higher priorities are tried first.
     *
     * @default 0
     */
    priority?: number
    stringify?: StringifyParamsFn<TPath, TParams>
  }

  /** 
  @deprecated Use params.parse instead
  */
  parseParams?: ParseParamsFn<TPath, TParams> &
    ValidateParsedParams<TPath, TParams>

  /** 
  @deprecated Use params.stringify instead
  */
  stringifyParams?: StringifyParamsFn<TPath, TParams>
}

interface RequiredStaticDataRouteOption {
  staticData: StaticDataRouteOption
}

interface OptionalStaticDataRouteOption {
  staticData?: StaticDataRouteOption
}

export type UpdatableStaticRouteOption = {} extends StaticDataRouteOption
  ? OptionalStaticDataRouteOption
  : RequiredStaticDataRouteOption

export type MetaDescriptor =
  | { charSet: 'utf-8' }
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { httpEquiv: string; content: string }
  | { 'script:ld+json': LdJsonObject }
  | { tagName: 'meta' | 'link'; [name: string]: string }
  | Record<string, unknown>

type LdJsonObject = { [Key in string]: LdJsonValue } & {
  [Key in string]?: LdJsonValue | undefined
}
type LdJsonArray = Array<LdJsonValue> | ReadonlyArray<LdJsonValue>
type LdJsonPrimitive = string | number | boolean | null
type LdJsonValue = LdJsonPrimitive | LdJsonObject | LdJsonArray

export type RouteLinkEntry = {}

export type SearchValidator<TInput, TOutput> =
  | ValidatorObj<TInput, TOutput>
  | ValidatorFn<TInput, TOutput>
  | ValidatorAdapter<TInput, TOutput>
  | StandardSchemaValidator<TInput, TOutput>
  | undefined

export type AnySearchValidator = SearchValidator<any, any>

export type DefaultSearchValidator = SearchValidator<
  Record<string, unknown>,
  AnySchema
>

export type RoutePrefix<
  TPrefix extends string,
  TPath extends string,
> = string extends TPath
  ? RootRouteId
  : TPath extends string
    ? TPrefix extends RootRouteId
      ? TPath extends '/'
        ? '/'
        : `/${TrimPath<TPath>}`
      : `${TPrefix}/${TPath}` extends '/'
        ? '/'
        : `/${TrimPathLeft<`${TrimPathRight<TPrefix>}/${TrimPath<TPath>}`>}`
    : never

export type TrimPath<T extends string> = '' extends T
  ? ''
  : TrimPathRight<TrimPathLeft<T>>

export type TrimPathLeft<T extends string> =
  T extends `${RootRouteId}/${infer U}`
    ? TrimPathLeft<U>
    : T extends `/${infer U}`
      ? TrimPathLeft<U>
      : T

export type TrimPathRight<T extends string> = T extends '/'
  ? '/'
  : T extends `${infer U}/`
    ? TrimPathRight<U>
    : T

export type ContextReturnType<TContextFn> = unknown extends TContextFn
  ? TContextFn
  : LooseReturnType<TContextFn> extends never
    ? AnyContext
    : LooseReturnType<TContextFn>

export type ContextAsyncReturnType<TContextFn> = unknown extends TContextFn
  ? TContextFn
  : LooseAsyncReturnType<TContextFn> extends never
    ? AnyContext
    : LooseAsyncReturnType<TContextFn>

export type ResolveRouteContext<TRouteContextFn, TBeforeLoadFn> = Assign<
  ContextReturnType<TRouteContextFn>,
  ContextAsyncReturnType<TBeforeLoadFn>
>

export type ResolveRouteLoaderFn<TLoaderFn> = TLoaderFn extends {
  handler: infer THandler
}
  ? THandler
  : TLoaderFn

export type RouteLoaderObject<
  TRegister,
  TParentRoute extends AnyRoute = AnyRoute,
  TId extends string = string,
  TParams = {},
  TLoaderDeps = {},
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TServerMiddlewares = unknown,
  THandlers = undefined,
> = {
  handler: RouteLoaderFn<
    TRegister,
    TParentRoute,
    TId,
    TParams,
    TLoaderDeps,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TServerMiddlewares,
    THandlers
  >
  staleReloadMode?: LoaderStaleReloadMode
}

export type ResolveLoaderData<TLoaderFn> = unknown extends TLoaderFn
  ? TLoaderFn
  : LooseAsyncReturnType<ResolveRouteLoaderFn<TLoaderFn>> extends never
    ? undefined
    : LooseAsyncReturnType<ResolveRouteLoaderFn<TLoaderFn>>

export type ResolveFullSearchSchema<
  TParentRoute extends AnyRoute,
  TSearchValidator,
> = unknown extends TParentRoute
  ? ResolveValidatorOutput<TSearchValidator>
  : IntersectAssign<
      InferFullSearchSchema<TParentRoute>,
      ResolveValidatorOutput<TSearchValidator>
    >

export type ResolveFullSearchSchemaInput<
  TParentRoute extends AnyRoute,
  TSearchValidator,
> = IntersectAssign<
  InferFullSearchSchemaInput<TParentRoute>,
  ResolveSearchValidatorInput<TSearchValidator>
>

export type ResolveAllParamsFromParent<
  TParentRoute extends AnyRoute,
  TParams,
> = Assign<InferAllParams<TParentRoute>, TParams>

export type RouteContextParameter<
  TParentRoute extends AnyRoute,
  TRouterContext,
> = unknown extends TParentRoute
  ? TRouterContext
  : Assign<TRouterContext, InferAllContext<TParentRoute>>

export type BeforeLoadContextParameter<
  TParentRoute extends AnyRoute,
  TRouterContext,
  TRouteContextFn,
> = Assign<
  RouteContextParameter<TParentRoute, TRouterContext>,
  ContextReturnType<TRouteContextFn>
>

export type ResolveAllContext<
  TParentRoute extends AnyRoute,
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
> = Assign<
  BeforeLoadContextParameter<TParentRoute, TRouterContext, TRouteContextFn>,
  ContextAsyncReturnType<TBeforeLoadFn>
>
export interface FullSearchSchemaOption<
  in out TParentRoute extends AnyRoute,
  in out TSearchValidator,
> {
  search: Expand<ResolveFullSearchSchema<TParentRoute, TSearchValidator>>
}

export interface RemountDepsOptions<
  in out TRouteId,
  in out TFullSearchSchema,
  in out TAllParams,
  in out TLoaderDeps,
> {
  routeId: TRouteId
  search: TFullSearchSchema
  params: TAllParams
  loaderDeps: TLoaderDeps
}

export type MakeRemountDepsOptionsUnion<
  TRouteTree extends AnyRoute = RegisteredRouter['routeTree'],
> =
  ParseRoute<TRouteTree> extends infer TRoute extends AnyRoute
    ? TRoute extends any
      ? RemountDepsOptions<
          TRoute['id'],
          TRoute['types']['fullSearchSchema'],
          TRoute['types']['allParams'],
          TRoute['types']['loaderDeps']
        >
      : never
    : never

export interface RouteTypes<
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
  parentRoute: TParentRoute
  path: TPath
  to: TrimPathRight<TFullPath>
  fullPath: TFullPath
  customId: TCustomId
  id: TId
  searchSchema: ResolveValidatorOutput<TSearchValidator>
  searchSchemaInput: ResolveSearchValidatorInput<TSearchValidator>
  searchValidator: TSearchValidator
  fullSearchSchema: ResolveFullSearchSchema<TParentRoute, TSearchValidator>
  fullSearchSchemaInput: ResolveFullSearchSchemaInput<
    TParentRoute,
    TSearchValidator
  >
  params: TParams
  allParams: ResolveAllParamsFromParent<TParentRoute, TParams>
  routerContext: TRouterContext
  routeContext: ResolveRouteContext<TRouteContextFn, TBeforeLoadFn>
  routeContextFn: TRouteContextFn
  beforeLoadFn: TBeforeLoadFn
  allContext: ResolveAllContext<
    TParentRoute,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn
  >
  children: TChildren
  loaderData: ResolveLoaderData<TLoaderFn>
  loaderDeps: TLoaderDeps
  fileRouteTypes: TFileRouteTypes
  ssr: ResolveSSR<TSSR>
  allSsr: ResolveAllSSR<TParentRoute, TSSR>
}

export type ResolveSSR<TSSR> = TSSR extends (...args: ReadonlyArray<any>) => any
  ? LooseReturnType<TSSR>
  : TSSR

export type ResolveAllSSR<
  TParentRoute extends AnyRoute,
  TSSR,
> = unknown extends TParentRoute
  ? ResolveSSR<TSSR>
  : unknown extends TSSR
    ? TParentRoute['types']['allSsr']
    : ResolveSSR<TSSR>

export type ResolveFullPath<
  TParentRoute extends AnyRoute,
  TPath extends string,
  TPrefixed = RoutePrefix<TParentRoute['fullPath'], TPath>,
> = TPrefixed extends RootRouteId ? '/' : TPrefixed

export interface RouteExtensions<in out TId, in out TFullPath> {
  id: TId
  fullPath: TFullPath
}

export type RouteLazyFn<TRoute extends AnyRoute> = (
  lazyFn: () => Promise<LazyRoute<TRoute>>,
) => TRoute

export type RouteAddChildrenFn<
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
  in out TLoaderDeps extends Record<string, any>,
  in out TLoaderFn,
  in out TFileRouteTypes,
  in out TSSR,
  in out TServerMiddlewares,
  in out THandlers,
> = <const TNewChildren>(
  children: Constrain<
    TNewChildren,
    ReadonlyArray<AnyRoute> | Record<string, AnyRoute>
  >,
) => Route<
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
  TNewChildren,
  TFileRouteTypes,
  TSSR,
  TServerMiddlewares,
  THandlers
>

export type RouteAddFileChildrenFn<
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
  in out TLoaderDeps extends Record<string, any>,
  in out TLoaderFn,
  in out TFileRouteTypes,
  in out TSSR,
  in out TServerMiddlewares,
  in out THandlers,
> = <const TNewChildren>(
  children: TNewChildren,
) => Route<
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
  TNewChildren,
  TFileRouteTypes,
  TSSR,
  TServerMiddlewares,
  THandlers
>

export type RouteAddFileTypesFn<
  TRegister,
  TParentRoute extends AnyRoute,
  TPath extends string,
  TFullPath extends string,
  TCustomId extends string,
  TId extends string,
  TSearchValidator,
  TParams,
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps extends Record<string, any>,
  TLoaderFn,
  TChildren,
  TSSR,
  TServerMiddlewares,
  THandlers,
> = <TNewFileRouteTypes>() => Route<
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
  TNewFileRouteTypes,
  TSSR,
  TServerMiddlewares,
  THandlers
>

export interface Route<
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
  in out TLoaderDeps extends Record<string, any>,
  in out TLoaderFn,
  in out TChildren,
  in out TFileRouteTypes,
  in out TSSR,
  in out TServerMiddlewares,
  in out THandlers,
> extends RouteExtensions<TId, TFullPath> {
  path: TPath
  parentRoute: TParentRoute
  children?: TChildren
  types: RouteTypes<
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
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TSSR,
    TServerMiddlewares,
    THandlers
  >
  isRoot: TParentRoute extends AnyRoute ? true : false
  /** @internal */
  _componentsPromise?: Promise<void>
  /** @internal */
  _componentsLoaded?: boolean
  lazyFn?: () => Promise<
    LazyRoute<
      Route<
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
    >
  >
  /** @internal */
  _lazyPromise?: Promise<void>
  /** @internal */
  _lazyLoaded?: boolean
  rank: number
  to: TrimPathRight<TFullPath>
  init: (opts: { originalIndex: number }) => void
  update: (
    options: UpdatableRouteOptions<
      TParentRoute,
      TCustomId,
      TFullPath,
      TParams,
      TSearchValidator,
      TLoaderFn,
      TLoaderDeps,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn
    >,
  ) => this
  lazy: RouteLazyFn<
    Route<
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
  >
  addChildren: RouteAddChildrenFn<
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
    TFileRouteTypes,
    TSSR,
    TServerMiddlewares,
    THandlers
  >
  _addFileChildren: RouteAddFileChildrenFn<
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
    TFileRouteTypes,
    TSSR,
    TServerMiddlewares,
    THandlers
  >
  _addFileTypes: RouteAddFileTypesFn<
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
    TSSR,
    TServerMiddlewares,
    THandlers
  >
  /**
   * Create a redirect with `from` automatically set to this route's path.
   * Enables relative redirects like `Route.redirect({ to: './overview' })`.
   * @param opts Redirect options (same as `redirect()` but without `from`)
   * @returns A redirect Response that can be thrown from loaders/beforeLoad
   * @link https://tanstack.com/router/latest/docs/framework/react/api/router/redirectFunction
   */
  redirect: RedirectFnRoute<TFullPath>
}

export type AnyRoute = Route<
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
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export type AnyRouteWithContext<TContext> = AnyRoute & {
  types: { allContext: TContext }
}

export type RouteOptions<
  TRegister,
  TParentRoute extends AnyRoute = AnyRoute,
  TId extends string = string,
  TCustomId extends string = string,
  TFullPath extends string = string,
  TPath extends string = string,
  TSearchValidator = undefined,
  TParams = AnyPathParams,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TSSR = unknown,
  TServerMiddlewares = unknown,
  THandlers = undefined,
> = BaseRouteOptions<
  TRegister,
  TParentRoute,
  TId,
  TCustomId,
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
> &
  UpdatableRouteOptions<
    NoInfer<TParentRoute>,
    NoInfer<TCustomId>,
    NoInfer<TFullPath>,
    NoInfer<TParams>,
    NoInfer<TSearchValidator>,
    NoInfer<TLoaderFn>,
    NoInfer<TLoaderDeps>,
    NoInfer<TRouterContext>,
    NoInfer<TRouteContextFn>,
    NoInfer<TBeforeLoadFn>
  >

export type RouteContextFn<
  in out TParentRoute extends AnyRoute,
  in out TSearchValidator,
  in out TParams,
  in out TRouterContext,
  in out TRouteId,
> = (
  ctx: RouteContextOptions<
    TParentRoute,
    TSearchValidator,
    TParams,
    TRouterContext,
    TRouteId
  >,
) => any

export type FileBaseRouteOptions<
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
> = ParamsOptions<TPath, TParams> &
  FilebaseRouteOptionsInterface<
    TRegister,
    TParentRoute,
    TId,
    TPath,
    TSearchValidator,
    TParams,
    TLoaderDeps,
    TLoaderFn,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TRemountDepsFn,
    TSSR,
    TServerMiddlewares,
    THandlers
  >

export interface FilebaseRouteOptionsInterface<
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
  validateSearch?: Constrain<TSearchValidator, AnyValidator, DefaultValidator>

  shouldReload?:
    | boolean
    | ((
        match: LoaderFnContext<
          TRegister,
          TParentRoute,
          TId,
          TParams,
          TLoaderDeps,
          TRouterContext,
          TRouteContextFn,
          TBeforeLoadFn,
          TServerMiddlewares,
          THandlers
        >,
      ) => any)

  context?: Constrain<
    TRouteContextFn,
    (
      ctx: RouteContextOptions<
        TParentRoute,
        TParams,
        TRouterContext,
        TLoaderDeps,
        TId
      >,
    ) => any
  >

  ssr?: Constrain<
    TSSR,
    | undefined
    | SSROption
    | ((
        ctx: SsrContextOptions<TParentRoute, TSearchValidator, TParams>,
      ) => Awaitable<undefined | SSROption>)
  >

  // This async function is called before a route is loaded.
  // If an error is thrown here, the route's loader will not be called.
  // If thrown during a navigation, the navigation will be cancelled and the error will be passed to the `onError` function.
  // If thrown during a preload event, the error will be logged to the console.
  beforeLoad?: Constrain<
    TBeforeLoadFn,
    (
      ctx: BeforeLoadContextOptions<
        TRegister,
        TParentRoute,
        TSearchValidator,
        TParams,
        TRouterContext,
        TRouteContextFn,
        TId,
        TServerMiddlewares,
        THandlers
      >,
    ) => ValidateSerializableLifecycleResult<
      TRegister,
      TParentRoute,
      TSSR,
      TBeforeLoadFn
    >
  >

  loaderDeps?: (
    opts: FullSearchSchemaOption<TParentRoute, TSearchValidator>,
  ) => TLoaderDeps

  remountDeps?: Constrain<
    TRemountDepsFn,
    (
      opt: RemountDepsOptions<
        TId,
        ResolveFullSearchSchema<TParentRoute, TSearchValidator>,
        Expand<ResolveAllParamsFromParent<TParentRoute, TParams>>,
        TLoaderDeps
      >,
    ) => any
  >

  loader?: Constrain<
    TLoaderFn,
    | RouteLoaderFn<
        TRegister,
        TParentRoute,
        TId,
        TParams,
        TLoaderDeps,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn,
        TServerMiddlewares,
        THandlers
      >
    | RouteLoaderObject<
        TRegister,
        TParentRoute,
        TId,
        TParams,
        TLoaderDeps,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn,
        TServerMiddlewares,
        THandlers
      >
  >
}

export type BaseRouteOptions<
  TRegister,
  TParentRoute extends AnyRoute = AnyRoute,
  TId extends string = string,
  TCustomId extends string = string,
  TPath extends string = string,
  TSearchValidator = undefined,
  TParams = {},
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TSSR = unknown,
  TServerMiddlewares = unknown,
  THandlers = undefined,
> = RoutePathOptions<TCustomId, TPath> &
  FileBaseRouteOptions<
    TRegister,
    TParentRoute,
    TId,
    TPath,
    TSearchValidator,
    TParams,
    TLoaderDeps,
    TLoaderFn,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    AnyContext,
    TSSR,
    TServerMiddlewares,
    THandlers
  > & {
    getParentRoute: () => TParentRoute
  }

export interface ContextOptions<
  in out TParentRoute extends AnyRoute,
  in out TParams,
  in out TRouteId,
> {
  abortController: AbortController
  preload: boolean
  params: Expand<ResolveAllParamsFromParent<TParentRoute, TParams>>
  location: ParsedLocation
  /**
   * @deprecated Use `throw redirect({ to: '/somewhere' })` instead
   **/
  navigate: NavigateFn
  buildLocation: BuildLocationFn
  cause: 'preload' | 'enter' | 'stay'
  matches: Array<MakeRouteMatchUnion>
  routeId: TRouteId
}

export interface RouteContextOptions<
  in out TParentRoute extends AnyRoute,
  in out TParams,
  in out TRouterContext,
  in out TLoaderDeps,
  in out TRouteId,
> extends ContextOptions<TParentRoute, TParams, TRouteId> {
  deps: TLoaderDeps
  context: Expand<RouteContextParameter<TParentRoute, TRouterContext>>
}

export interface SsrContextOptions<
  in out TParentRoute extends AnyRoute,
  in out TSearchValidator,
  in out TParams,
> {
  params:
    | {
        status: 'success'
        value: Expand<ResolveAllParamsFromParent<TParentRoute, TParams>>
      }
    | { status: 'error'; error: unknown }
  search:
    | {
        status: 'success'
        value: Expand<ResolveFullSearchSchema<TParentRoute, TSearchValidator>>
      }
    | { status: 'error'; error: unknown }
  location: ParsedLocation
  matches: Array<MakePreValidationErrorHandlingRouteMatchUnion>
}

export interface BeforeLoadContextOptions<
  in out TRegister,
  in out TParentRoute extends AnyRoute,
  in out TSearchValidator,
  in out TParams,
  in out TRouterContext,
  in out TRouteContextFn,
  in out TRouteId,
  in out TServerMiddlewares,
  in out THandlers,
>
  extends
    ContextOptions<TParentRoute, TParams, TRouteId>,
    FullSearchSchemaOption<TParentRoute, TSearchValidator> {
  context: Expand<
    BeforeLoadContextParameter<TParentRoute, TRouterContext, TRouteContextFn>
  >
}

type AssetFnContextOptions<
  in out TRouteId,
  in out TFullPath,
  in out TParentRoute extends AnyRoute,
  in out TParams,
  in out TSearchValidator,
  in out TLoaderFn,
  in out TRouterContext,
  in out TRouteContextFn,
  in out TBeforeLoadFn,
  in out TLoaderDeps,
> = {
  ssr?: {
    nonce?: string
  }
  matches: Array<
    RouteMatch<
      TRouteId,
      TFullPath,
      ResolveAllParamsFromParent<TParentRoute, TParams>,
      ResolveFullSearchSchema<TParentRoute, TSearchValidator>,
      ResolveLoaderData<TLoaderFn>,
      ResolveAllContext<
        TParentRoute,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn
      >,
      TLoaderDeps
    >
  >
  match: RouteMatch<
    TRouteId,
    TFullPath,
    ResolveAllParamsFromParent<TParentRoute, TParams>,
    ResolveFullSearchSchema<TParentRoute, TSearchValidator>,
    ResolveLoaderData<TLoaderFn>,
    ResolveAllContext<
      TParentRoute,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn
    >,
    TLoaderDeps
  >
  params: ResolveAllParamsFromParent<TParentRoute, TParams>
  loaderData?: ResolveLoaderData<TLoaderFn>
}

export interface DefaultUpdatableRouteOptionsExtensions {
  component?: unknown
  errorComponent?: unknown
  notFoundComponent?: unknown
  pendingComponent?: unknown
}

export interface UpdatableRouteOptionsExtensions extends DefaultUpdatableRouteOptionsExtensions {}

export interface UpdatableRouteOptions<
  in out TParentRoute extends AnyRoute,
  in out TRouteId,
  in out TFullPath,
  in out TParams,
  in out TSearchValidator,
  in out TLoaderFn,
  in out TLoaderDeps,
  in out TRouterContext,
  in out TRouteContextFn,
  in out TBeforeLoadFn,
>
  extends UpdatableStaticRouteOption, UpdatableRouteOptionsExtensions {
  /**
   * If true, this route will be matched as case-sensitive
   *
   * @default false
   */
  caseSensitive?: boolean
  /**
   * If true, this route will be forcefully wrapped in a suspense boundary
   */
  wrapInSuspense?: boolean
  // The content to be rendered when the route is matched. If no component is provided, defaults to `<Outlet />`

  pendingMs?: number
  pendingMinMs?: number
  staleTime?: number
  gcTime?: number
  preload?: boolean
  preloadStaleTime?: number
  preloadGcTime?: number
  search?: {
    middlewares?: Array<
      SearchMiddleware<ResolveFullSearchSchema<TParentRoute, TSearchValidator>>
    >
  }
  /** 
  @deprecated Use search.middlewares instead
  */
  preSearchFilters?: Array<
    SearchFilter<ResolveFullSearchSchema<TParentRoute, TSearchValidator>>
  >
  /** 
  @deprecated Use search.middlewares instead
  */
  postSearchFilters?: Array<
    SearchFilter<ResolveFullSearchSchema<TParentRoute, TSearchValidator>>
  >
  onCatch?: (error: Error) => void
  onError?: (err: any) => void
  // These functions are called as route matches are loaded, stick around and leave the active
  // matches
  onEnter?: (
    match: RouteMatch<
      TRouteId,
      TFullPath,
      ResolveAllParamsFromParent<TParentRoute, TParams>,
      ResolveFullSearchSchema<TParentRoute, TSearchValidator>,
      ResolveLoaderData<TLoaderFn>,
      ResolveAllContext<
        TParentRoute,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn
      >,
      TLoaderDeps
    >,
  ) => void
  onStay?: (
    match: RouteMatch<
      TRouteId,
      TFullPath,
      ResolveAllParamsFromParent<TParentRoute, TParams>,
      ResolveFullSearchSchema<TParentRoute, TSearchValidator>,
      ResolveLoaderData<TLoaderFn>,
      ResolveAllContext<
        TParentRoute,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn
      >,
      TLoaderDeps
    >,
  ) => void
  onLeave?: (
    match: RouteMatch<
      TRouteId,
      TFullPath,
      ResolveAllParamsFromParent<TParentRoute, TParams>,
      ResolveFullSearchSchema<TParentRoute, TSearchValidator>,
      ResolveLoaderData<TLoaderFn>,
      ResolveAllContext<
        TParentRoute,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn
      >,
      TLoaderDeps
    >,
  ) => void
  headers?: (
    ctx: AssetFnContextOptions<
      TRouteId,
      TFullPath,
      TParentRoute,
      TParams,
      TSearchValidator,
      TLoaderFn,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps
    >,
  ) => Awaitable<Record<string, string> | undefined>
  head?: (
    ctx: AssetFnContextOptions<
      TRouteId,
      TFullPath,
      TParentRoute,
      TParams,
      TSearchValidator,
      TLoaderFn,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps
    >,
  ) => Awaitable<{
    links?: AnyRouteMatch['links']
    scripts?: AnyRouteMatch['headScripts']
    meta?: AnyRouteMatch['meta']
    styles?: AnyRouteMatch['styles']
  }>
  scripts?: (
    ctx: AssetFnContextOptions<
      TRouteId,
      TFullPath,
      TParentRoute,
      TParams,
      TSearchValidator,
      TLoaderFn,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TLoaderDeps
    >,
  ) => Awaitable<AnyRouteMatch['scripts']>
  codeSplitGroupings?: Array<
    Array<
      | 'loader'
      | 'component'
      | 'pendingComponent'
      | 'notFoundComponent'
      | 'errorComponent'
    >
  >
}

export type RouteLoaderFn<
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
> = (
  match: LoaderFnContext<
    TRegister,
    TParentRoute,
    TId,
    TParams,
    TLoaderDeps,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TServerMiddlewares,
    THandlers
  >,
) => any

export type LoaderStaleReloadMode = 'background' | 'blocking'

export type RouteLoaderEntry<
  TRegister,
  TParentRoute extends AnyRoute = AnyRoute,
  TId extends string = string,
  TParams = {},
  TLoaderDeps = {},
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TServerMiddlewares = unknown,
  THandlers = undefined,
> =
  | RouteLoaderFn<
      TRegister,
      TParentRoute,
      TId,
      TParams,
      TLoaderDeps,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TServerMiddlewares,
      THandlers
    >
  | RouteLoaderObject<
      TRegister,
      TParentRoute,
      TId,
      TParams,
      TLoaderDeps,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn,
      TServerMiddlewares,
      THandlers
    >

export interface LoaderFnContext<
  in out TRegister = unknown,
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
  abortController: AbortController
  preload: boolean
  params: Expand<ResolveAllParamsFromParent<TParentRoute, TParams>>
  deps: TLoaderDeps
  context: Expand<
    ResolveAllContext<
      TParentRoute,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn
    >
  >
  location: ParsedLocation // Do not supply search schema here so as to demotivate people from trying to shortcut loaderDeps
  /**
   * @deprecated Use `throw redirect({ to: '/somewhere' })` instead
   **/
  navigate: (opts: NavigateOptions<AnyRouter>) => Promise<void> | void
  // root route does not have a parent match
  parentMatchPromise: TId extends RootRouteId
    ? never
    : Promise<MakeRouteMatchFromRoute<TParentRoute>>
  cause: 'preload' | 'enter' | 'stay'
  route: AnyRoute
}

export interface DefaultRootRouteOptionsExtensions {
  shellComponent?: unknown
}

export interface RootRouteOptionsExtensions extends DefaultRootRouteOptionsExtensions {}

export interface RootRouteOptions<
  TRegister = unknown,
  TSearchValidator = undefined,
  TRouterContext = {},
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TSSR = unknown,
  TServerMiddlewares = unknown,
  THandlers = undefined,
>
  extends
    Omit<
      RouteOptions<
        TRegister,
        any, // TParentRoute
        RootRouteId, // TId
        RootRouteId, // TCustomId
        '', // TFullPath
        '', // TPath
        TSearchValidator,
        {}, // TParams
        TLoaderDeps,
        TLoaderFn,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn,
        TSSR,
        TServerMiddlewares,
        THandlers
      >,
      | 'path'
      | 'id'
      | 'getParentRoute'
      | 'caseSensitive'
      | 'parseParams'
      | 'stringifyParams'
      | 'params'
    >,
    RootRouteOptionsExtensions {}

export type RouteConstraints = {
  TParentRoute: AnyRoute
  TPath: string
  TFullPath: string
  TCustomId: string
  TId: string
  TSearchSchema: AnySchema
  TFullSearchSchema: AnySchema
  TParams: Record<string, any>
  TAllParams: Record<string, any>
  TParentContext: AnyContext
  TRouteContext: RouteContext
  TAllContext: AnyContext
  TRouterContext: AnyContext
  TChildren: unknown
  TRouteTree: AnyRoute
}

export type RouteTypesById<TRouter extends AnyRouter, TId> = RouteById<
  TRouter['routeTree'],
  TId
>['types']

export type RouteMask<TRouteTree extends AnyRoute> = {
  routeTree: TRouteTree
  from: RoutePaths<TRouteTree>
  to?: any
  params?: any
  search?: any
  hash?: any
  state?: any
  unmaskOnReload?: boolean
}

/**
 * @deprecated Use `ErrorComponentProps` instead.
 */
export type ErrorRouteProps = {
  error: unknown
  info?: { componentStack: string }
  reset: () => void
}

export type ErrorComponentProps<TError = Error> = {
  error: TError
  info?: { componentStack: string }
  reset: () => void
}

export type NotFoundRouteProps = {
  data?: unknown
  isNotFound: boolean
  routeId: RouteIds<RegisteredRouter['routeTree']>
}

export class BaseRoute<
  in out TRegister = Register,
  in out TParentRoute extends AnyRoute = AnyRoute,
  in out TPath extends string = '/',
  in out TFullPath extends string = ResolveFullPath<TParentRoute, TPath>,
  in out TCustomId extends string = string,
  in out TId extends string = ResolveId<TParentRoute, TCustomId, TPath>,
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
> {
  isRoot: TParentRoute extends AnyRoute ? true : false
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
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TSSR,
    TServerMiddlewares,
    THandlers
  >

  // The following properties are set up in this.init()
  parentRoute!: TParentRoute
  private _id!: TId
  private _path!: TPath
  private _fullPath!: TFullPath
  private _to!: TrimPathRight<TFullPath>

  public get to() {
    return this._to
  }

  public get id() {
    return this._id
  }

  public get path() {
    return this._path
  }

  public get fullPath() {
    return this._fullPath
  }

  // Optional
  children?: TChildren
  originalIndex?: number
  rank!: number
  lazyFn?: () => Promise<
    LazyRoute<
      Route<
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
    >
  >
  /** @internal */
  _lazyPromise?: Promise<void>
  /** @internal */
  _componentsPromise?: Promise<void>

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
    this.options = (options as any) || {}
    this.isRoot = !options?.getParentRoute as any

    if ((options as any)?.id && (options as any)?.path) {
      throw new Error(`Route cannot have both an 'id' and a 'path' option.`)
    }
  }

  types!: RouteTypes<
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

  init = (opts: { originalIndex: number }): void => {
    this.originalIndex = opts.originalIndex

    const options = this.options as
      | (RouteOptions<
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
          TServerMiddlewares
        > &
          RoutePathOptionsIntersection<TCustomId, TPath>)
      | undefined

    const isRoot = !options?.path && !options?.id

    this.parentRoute = this.options.getParentRoute?.()

    if (isRoot) {
      this._path = rootRouteId as TPath
    } else if (!this.parentRoute) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          `Invariant failed: Child Route instances must pass a 'getParentRoute: () => ParentRoute' option that returns a Route instance.`,
        )
      }

      invariant()
    }

    let path: undefined | string = isRoot ? rootRouteId : options?.path

    // If the path is anything other than an index path, trim it up
    if (path && path !== '/') {
      path = trimPathLeft(path)
    }

    const customId = options?.id || path

    // Strip the parentId prefix from the first level of children
    let id = isRoot
      ? rootRouteId
      : joinPaths([
          this.parentRoute.id === rootRouteId ? '' : this.parentRoute.id,
          customId,
        ])

    if (path === rootRouteId) {
      path = '/'
    }

    if (id !== rootRouteId) {
      id = joinPaths(['/', id])
    }

    const fullPath =
      id === rootRouteId ? '/' : joinPaths([this.parentRoute.fullPath, path])

    this._path = path as TPath
    this._id = id as TId
    this._fullPath = fullPath as TFullPath
    this._to = trimPathRight(fullPath) as TrimPathRight<TFullPath>
  }

  addChildren: RouteAddChildrenFn<
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
    TFileRouteTypes,
    TSSR,
    TServerMiddlewares,
    THandlers
  > = (children) => {
    return this._addFileChildren(children) as any
  }

  _addFileChildren: RouteAddFileChildrenFn<
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
    TFileRouteTypes,
    TSSR,
    TServerMiddlewares,
    THandlers
  > = (children) => {
    if (Array.isArray(children)) {
      this.children = children as TChildren
    }

    if (typeof children === 'object' && children !== null) {
      this.children = Object.values(children) as TChildren
    }

    return this as any
  }

  _addFileTypes: RouteAddFileTypesFn<
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
    TSSR,
    TServerMiddlewares,
    THandlers
  > = () => {
    return this as any
  }

  updateLoader = <TNewLoaderFn>(options: {
    loader: Constrain<
      TNewLoaderFn,
      RouteLoaderFn<
        TRegister,
        TParentRoute,
        TCustomId,
        TParams,
        TLoaderDeps,
        TRouterContext,
        TRouteContextFn,
        TBeforeLoadFn
      >
    >
  }) => {
    Object.assign(this.options, options)
    return this as unknown as BaseRoute<
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
      TNewLoaderFn,
      TChildren,
      TFileRouteTypes,
      TSSR,
      TServerMiddlewares,
      THandlers
    >
  }

  update = (
    options: UpdatableRouteOptions<
      TParentRoute,
      TCustomId,
      TFullPath,
      TParams,
      TSearchValidator,
      TLoaderFn,
      TLoaderDeps,
      TRouterContext,
      TRouteContextFn,
      TBeforeLoadFn
    >,
  ): this => {
    Object.assign(this.options, options)
    return this
  }

  lazy: RouteLazyFn<
    Route<
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
  > = (lazyFn) => {
    this.lazyFn = lazyFn
    return this
  }

  /**
   * Create a redirect with `from` automatically set to this route's fullPath.
   * Enables relative redirects like `Route.redirect({ to: './overview' })`.
   * @param opts Redirect options (same as `redirect()` but without `from`)
   * @returns A redirect Response that can be thrown from loaders/beforeLoad
   * @link https://tanstack.com/router/latest/docs/framework/react/api/router/redirectFunction
   */
  redirect: RedirectFnRoute<TFullPath> = (opts) =>
    redirect({ from: this.fullPath, ...opts } as any)
}

export class BaseRouteApi<TId, TRouter extends AnyRouter = RegisteredRouter> {
  id: TId

  constructor({ id }: { id: TId }) {
    this.id = id
  }

  notFound = (opts?: NotFoundError) => {
    return notFound({ routeId: this.id as string, ...opts })
  }

  /**
   * Create a redirect with `from` automatically set to this route's path.
   * Enables relative redirects like `routeApi.redirect({ to: './overview' })`.
   * @param opts Redirect options (same as `redirect()` but without `from`)
   * @returns A redirect Response that can be thrown from loaders/beforeLoad
   * @link https://tanstack.com/router/latest/docs/framework/react/api/router/redirectFunction
   */
  redirect: RedirectFnRoute<RouteTypesById<TRouter, TId>['fullPath']> = (
    opts,
  ) => redirect({ from: this.id as string, ...opts } as any)
}

export interface RootRoute<
  in out TRegister,
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
> extends Route<
  TRegister,
  any, // TParentRoute
  '/', // TPath
  '/', // TFullPath
  string, // TCustomId
  RootRouteId, // TId
  TSearchValidator, // TSearchValidator
  {}, // TParams
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  TChildren, // TChildren
  TFileRouteTypes,
  TSSR,
  TServerMiddlewares,
  THandlers
> {}

export class BaseRootRoute<
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
  in out TServerMiddlewares = unknown,
  in out THandlers = undefined,
> extends BaseRoute<
  TRegister,
  any, // TParentRoute
  '/', // TPath
  '/', // TFullPath
  string, // TCustomId
  RootRouteId, // TId
  TSearchValidator, // TSearchValidator
  {}, // TParams
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  TChildren, // TChildren
  TFileRouteTypes,
  TSSR,
  TServerMiddlewares,
  THandlers
> {
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
    super(options as any)
  }
}

//

export interface RouteLike {
  id: string
  isRoot?: boolean
  path?: string
  fullPath: string
  rank?: number
  parentRoute?: RouteLike
  children?: Array<RouteLike>
  options?: {
    caseSensitive?: boolean
  }
}
