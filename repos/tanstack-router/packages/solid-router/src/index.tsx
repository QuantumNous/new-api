export {
  defer,
  isMatch,
  joinPaths,
  cleanPath,
  trimPathLeft,
  trimPathRight,
  trimPath,
  resolvePath,
  interpolatePath,
  rootRouteId,
  defaultParseSearch,
  defaultStringifySearch,
  parseSearchWith,
  stringifySearchWith,
  functionalUpdate,
  replaceEqualDeep,
  isPlainObject,
  isPlainArray,
  deepEqual,
  createControlledPromise,
  retainSearchParams,
  stripSearchParams,
  createSerializationAdapter,
} from '@tanstack/router-core'

export type {
  DeferredPromiseState,
  DeferredPromise,
  ParsedLocation,
  RemoveTrailingSlashes,
  RemoveLeadingSlashes,
  ActiveOptions,
  ResolveRelativePath,
  RootRouteId,
  AnyPathParams,
  ResolveParams,
  ResolveOptionalParams,
  ResolveRequiredParams,
  SearchSchemaInput,
  AnyContext,
  RouteContext,
  PreloadableObj,
  RoutePathOptions,
  StaticDataRouteOption,
  RoutePathOptionsIntersection,
  UpdatableStaticRouteOption,
  MetaDescriptor,
  RouteLinkEntry,
  ParseParamsFn,
  SearchFilter,
  ResolveId,
  InferFullSearchSchema,
  InferFullSearchSchemaInput,
  ErrorRouteProps,
  ErrorComponentProps,
  NotFoundRouteProps,
  TrimPath,
  TrimPathLeft,
  TrimPathRight,
  StringifyParamsFn,
  ParamsOptions,
  InferAllParams,
  InferAllContext,
  LooseReturnType,
  LooseAsyncReturnType,
  ContextReturnType,
  ContextAsyncReturnType,
  ResolveLoaderData,
  ResolveRouteContext,
  SearchSerializer,
  SearchParser,
  TrailingSlashOption,
  Manifest,
  RouterManagedTag,
  ControlledPromise,
  Constrain,
  Expand,
  MergeAll,
  Assign,
  IntersectAssign,
  ResolveValidatorInput,
  ResolveValidatorOutput,
  AnyValidator,
  DefaultValidator,
  ValidatorFn,
  AnySchema,
  AnyValidatorAdapter,
  AnyValidatorFn,
  AnyValidatorObj,
  ResolveValidatorInputFn,
  ResolveValidatorOutputFn,
  ResolveSearchValidatorInput,
  ResolveSearchValidatorInputFn,
  Validator,
  ValidatorAdapter,
  ValidatorObj,
  NavigateFn,
  BuildLocationFn,
  InferDescendantToPaths,
  RelativeToPath,
  RelativeToParentPath,
  RelativeToCurrentPath,
  Register,
  AbsoluteToPath,
  RelativeToPathAutoComplete,
  NavigateOptions,
  ToOptions,
  ToMaskOptions,
  ToSubOptions,
  ResolveRoute,
  SearchParamOptions,
  PathParamOptions,
  ToPathOption,
  LinkOptions,
  MakeOptionalPathParams,
  AnyRouterWithContext,
  ParseRoute,
  RoutesById,
  RouteById,
  RouteIds,
  RoutesByPath,
  RouteByPath,
  RoutePaths,
  FullSearchSchema,
  AllParams,
  AllLoaderData,
  FullSearchSchemaInput,
  AllContext,
  CommitLocationOptions,
  MatchLocation,
  ResolveFullSearchSchema,
  ResolveFullSearchSchemaInput,
  ResolveAllParamsFromParent,
  RouteContextParameter,
  BeforeLoadContextParameter,
  ResolveAllContext,
  FullSearchSchemaOption,
  MakeRemountDepsOptionsUnion,
  RemountDepsOptions,
  FileRouteTypes,
  FileRoutesByPath,
  UseNavigateResult,
  AnyRedirect,
  Redirect,
  RedirectOptions,
  ResolvedRedirect,
  RouteOptions,
  FileBaseRouteOptions,
  BaseRouteOptions,
  UpdatableRouteOptions,
  RouteLoaderFn,
  LoaderFnContext,
  MakeRouteMatch,
  MakeRouteMatchUnion,
  RouteMatch,
  AnyRouteMatch,
  RouteContextFn,
  RouteContextOptions,
  BeforeLoadContextOptions,
  ContextOptions,
  RootRouteOptions,
  AnyRouteWithContext,
  LazyRouteOptions,
  AnyRoute,
  ResolveFullPath,
  RouteConstraints,
  RouterState,
  ListenerFn,
  BuildNextOptions,
  AnyRouter,
  RegisteredRouter,
  RouterEvents,
  RouterEvent,
  RouterListener,
  MatchRouteOptions,
  RouteMask,
  RouterContextOptions,
  RouterOptions,
  RouterConstructorOptions,
  ControllablePromise,
  InjectedHtmlEntry,
  CreateFileRoute,
  CreateLazyFileRoute,
  AnySerializationAdapter,
  SerializationAdapter,
  SerializableExtensions,
} from '@tanstack/router-core'

export {
  createHistory,
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
} from '@tanstack/history'

export type {
  BlockerFn,
  HistoryLocation,
  RouterHistory,
  ParsedPath,
  HistoryState,
} from '@tanstack/history'

export { useAwaited, Await } from './awaited'
export type { AwaitOptions } from './awaited'

export { CatchBoundary, ErrorComponent } from './CatchBoundary'
export { ClientOnly, useHydrated } from './ClientOnly'

export {
  FileRoute,
  createFileRoute,
  FileRouteLoader,
  LazyRoute,
  createLazyRoute,
  createLazyFileRoute,
} from './fileRoute'

export * from './history'

export { lazyRouteComponent } from './lazyRouteComponent'

export { useLinkProps, createLink, Link, linkOptions } from './link'
export type {
  UseLinkPropsOptions,
  ActiveLinkOptions,
  LinkProps,
  LinkComponent,
  LinkComponentProps,
  CreateLinkProps,
} from './link'

export {
  Matches,
  useMatchRoute,
  MatchRoute,
  useMatches,
  useParentMatches,
  useChildMatches,
} from './Matches'

export type { UseMatchRouteOptions, MakeMatchRouteOptions } from './Matches'

export { Match, Outlet } from './Match'

export { useMatch } from './useMatch'
export { useLoaderDeps } from './useLoaderDeps'
export { useLoaderData } from './useLoaderData'

export {
  redirect,
  isRedirect,
  DEFAULT_PROTOCOL_ALLOWLIST,
} from '@tanstack/router-core'

export {
  RouteApi,
  getRouteApi,
  Route,
  createRoute,
  RootRoute,
  rootRouteWithContext,
  createRootRoute,
  createRootRouteWithContext,
  createRouteMask,
  NotFoundRoute,
} from './route'
export type {
  AnyRootRoute,
  SolidNode,
  AsyncRouteComponent,
  RouteComponent,
  ErrorRouteComponent,
  NotFoundRouteComponent,
} from './route'

export { createRouter, Router } from './router'

export { lazyFn, SearchParamError } from '@tanstack/router-core'

export { RouterProvider, RouterContextProvider } from './RouterProvider'
export type { RouterProps } from './RouterProvider'

export {
  useElementScrollRestoration,
  ScrollRestoration,
} from './ScrollRestoration'

export type { UseBlockerOpts, ShouldBlockFn } from './useBlocker'
export { useBlocker, Block } from './useBlocker'

export { useNavigate, Navigate } from './useNavigate'

export { useParams } from './useParams'
export { useSearch } from './useSearch'

export { useRouteContext } from './useRouteContext'
export { useRouter } from './useRouter'
export { useRouterState } from './useRouterState'
export { useLocation } from './useLocation'
export { useCanGoBack } from './useCanGoBack'

export { CatchNotFound, DefaultGlobalNotFound } from './not-found'
export { notFound, isNotFound } from '@tanstack/router-core'
export type { NotFoundError } from '@tanstack/router-core'

export type {
  ValidateLinkOptions,
  ValidateUseSearchOptions,
  ValidateUseParamsOptions,
  ValidateLinkOptionsArray,
} from './typePrimitives'

export type {
  ValidateFromPath,
  ValidateToPath,
  ValidateSearch,
  ValidateParams,
  InferFrom,
  InferTo,
  InferMaskTo,
  InferMaskFrom,
  ValidateNavigateOptions,
  ValidateNavigateOptionsArray,
  ValidateRedirectOptions,
  ValidateRedirectOptionsArray,
  ValidateId,
  InferStrict,
  InferShouldThrow,
  InferSelected,
  ValidateUseSearchResult,
  ValidateUseParamsResult,
} from '@tanstack/router-core'

export { ScriptOnce } from './ScriptOnce'

export { Asset } from './Asset'
export { HeadContent } from './HeadContent'
export { useTags } from './headContentUtils'
export { Scripts } from './Scripts'
export { composeRewrites } from '@tanstack/router-core'
export type {
  LocationRewrite,
  LocationRewriteFunction,
} from '@tanstack/router-core'
