export * from './global'

export { TSR_DEFERRED_PROMISE, defer } from './defer'
export type { DeferredPromiseState, DeferredPromise } from './defer'
export { invariant } from './invariant'
export { preloadWarning } from './link'
export type {
  IsRequiredParams,
  AddTrailingSlash,
  RemoveTrailingSlashes,
  AddLeadingSlash,
  RemoveLeadingSlashes,
  ActiveOptions,
  LinkOptionsProps,
  ResolveCurrentPath,
  ResolveParentPath,
  ResolveRelativePath,
  FindDescendantToPaths,
  InferDescendantToPaths,
  RelativeToPath,
  RelativeToParentPath,
  RelativeToCurrentPath,
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
  FromPathOption,
  MakeOptionalSearchParams,
  MaskOptions,
  ToSubOptionsProps,
  RequiredToOptions,
} from './link'

export type {
  RouteToPath,
  TrailingSlashOptionByRouter,
  ParseRoute,
  CodeRouteToPath,
  RouteIds,
  FullSearchSchema,
  FullSearchSchemaInput,
  AllParams,
  RouteById,
  AllContext,
  RoutePaths,
  RoutesById,
  RoutesByPath,
  AllLoaderData,
  RouteByPath,
} from './routeInfo'

export type {
  InferFileRouteTypes,
  FileRouteTypes,
  FileRoutesByPath,
  CreateFileRoute,
  LazyRoute,
  LazyRouteOptions,
  CreateLazyFileRoute,
} from './fileRoute'

export type { ParsedLocation } from './location'
export type {
  Manifest,
  ServerManifest,
  ManifestRoute,
  ManifestRouteAssets,
  ServerManifestRoute,
  ManifestCssLink,
  ManifestInlineCss,
  ServerManifestInlineCss,
  InlineCssTemplate,
  ManifestScript,
  RouterManagedTag,
  RouterManagedTitleTag,
  RouterManagedMetaTag,
  RouterManagedInlineCssTag,
  RouterManagedScriptTag,
  RouterManagedLinkTag,
  RouterManagedStyleTag,
  AssetCrossOrigin,
  AssetCrossOriginConfig,
  ManifestAssetLink,
  ScriptFormat,
} from './manifest'
export {
  DEV_STYLES_ATTR,
  appendUniqueUserTags,
  createInlineCssStyleAsset,
  getAssetCrossOrigin,
  getManifestScriptFormat,
  getScriptPreloadAttrs,
  getStylesheetHref,
  resolveManifestAssetLink,
  resolveManifestCssLink,
} from './manifest'
export { isMatch } from './Matches'
export type {
  AnyMatchAndValue,
  FindValueByIndex,
  FindValueByKey,
  CreateMatchAndValue,
  NextMatchAndValue,
  IsMatchKeyOf,
  IsMatchPath,
  IsMatchResult,
  IsMatchParse,
  IsMatch,
  RouteMatch,
  RouteMatchExtensions,
  MakeRouteMatchUnion,
  MakeRouteMatch,
  AnyRouteMatch,
  MakeRouteMatchFromRoute,
  MatchRouteOptions,
} from './Matches'
export {
  joinPaths,
  cleanPath,
  trimPathLeft,
  trimPathRight,
  trimPath,
  removeTrailingSlash,
  exactPathTest,
  resolvePath,
  interpolatePath,
} from './path'
export { encode, decode } from './qss'
export { rootRouteId } from './root'
export type { RootRouteId } from './root'

export { BaseRoute, BaseRouteApi, BaseRootRoute } from './route'
export type {
  AnyPathParams,
  SearchSchemaInput,
  AnyContext,
  RouteContext,
  PreloadableObj,
  RoutePathOptions,
  StaticDataRouteOption,
  RoutePathOptionsIntersection,
  SearchFilter,
  SearchMiddlewareContext,
  SearchMiddleware,
  ResolveId,
  InferFullSearchSchema,
  InferFullSearchSchemaInput,
  InferAllParams,
  InferAllContext,
  MetaDescriptor,
  RouteLinkEntry,
  SearchValidator,
  AnySearchValidator,
  DefaultSearchValidator,
  ErrorRouteProps,
  ErrorComponentProps,
  NotFoundRouteProps,
  ResolveParams,
  ParseParamsFn,
  StringifyParamsFn,
  ParamsOptions,
  UpdatableStaticRouteOption,
  ContextReturnType,
  ContextAsyncReturnType,
  ResolveRouteContext,
  ResolveLoaderData,
  RoutePrefix,
  TrimPath,
  TrimPathLeft,
  TrimPathRight,
  ResolveSearchSchemaFnInput,
  ResolveSearchSchemaInput,
  ResolveSearchSchemaFn,
  ResolveSearchSchema,
  ResolveFullSearchSchema,
  ResolveFullSearchSchemaInput,
  ResolveAllContext,
  BeforeLoadContextParameter,
  RouteContextParameter,
  ResolveAllParamsFromParent,
  AnyRoute,
  Route,
  RouteTypes,
  FullSearchSchemaOption,
  RemountDepsOptions,
  MakeRemountDepsOptionsUnion,
  ResolveFullPath,
  AnyRouteWithContext,
  RouteOptions,
  FileBaseRouteOptions,
  BaseRouteOptions,
  UpdatableRouteOptions,
  LoaderStaleReloadMode,
  RouteLoaderFn,
  RouteLoaderEntry,
  LoaderFnContext,
  RouteContextFn,
  ContextOptions,
  RouteContextOptions,
  SsrContextOptions,
  BeforeLoadContextOptions,
  RootRouteOptions,
  RootRouteOptionsExtensions,
  UpdatableRouteOptionsExtensions,
  RouteConstraints,
  RouteTypesById,
  RouteMask,
  RouteExtensions,
  RouteLazyFn,
  RouteAddChildrenFn,
  RouteAddFileChildrenFn,
  RouteAddFileTypesFn,
  ResolveOptionalParams,
  ResolveRequiredParams,
  RootRoute,
  FilebaseRouteOptionsInterface,
} from './route'
export {
  createNonReactiveMutableStore,
  createNonReactiveReadonlyStore,
} from './stores'
export type {
  RouterBatchFn,
  RouterReadableStore,
  GetStoreConfig,
  RouterStores,
  RouterWritableStore,
} from './stores'
export {
  defaultSerializeError,
  getLocationChangeInfo,
  RouterCore,
  lazyFn,
  SearchParamError,
  PathParamError,
  getInitialRouterState,
  getMatchedRoutes,
  trailingSlashOptions,
} from './router'

export type {
  ViewTransitionOptions,
  TrailingSlashOption,
  Register,
  AnyRouter,
  AnyRouterWithContext,
  RegisteredRouter,
  RouterState,
  BuildNextOptions,
  RouterListener,
  RouterEvent,
  ListenerFn,
  RouterEvents,
  MatchRoutesOpts,
  RouterOptionsExtensions,
  DefaultRemountDepsFn,
  PreloadRouteFn,
  MatchRouteFn,
  RouterContextOptions,
  RouterOptions,
  RouterConstructorOptions,
  UpdateFn,
  ParseLocationFn,
  InvalidateFn,
  ControllablePromise,
  InjectedHtmlEntry,
  EmitFn,
  LoadFn,
  GetMatchFn,
  SubscribeFn,
  UpdateMatchFn,
  CommitLocationFn,
  GetMatchRoutesFn,
  MatchRoutesFn,
  StartTransitionFn,
  LoadRouteChunkFn,
  ClearCacheFn,
  CreateRouterFn,
  SSROption,
} from './router'

export * from './config'

export type {
  MatchLocation,
  CommitLocationOptions,
  NavigateFn,
  BuildLocationFn,
} from './RouterProvider'

export { retainSearchParams, stripSearchParams } from './searchMiddleware'

export {
  defaultParseSearch,
  defaultStringifySearch,
  parseSearchWith,
  stringifySearchWith,
} from './searchParams'
export type { SearchSerializer, SearchParser } from './searchParams'

export type { OptionalStructuralSharing } from './structuralSharing'

export {
  functionalUpdate,
  hasKeys,
  replaceEqualDeep,
  isPlainObject,
  isPlainArray,
  deepEqual,
  createControlledPromise,
  isModuleNotFoundError,
  DEFAULT_PROTOCOL_ALLOWLIST,
  escapeHtml,
  isDangerousProtocol,
  buildDevStylesUrl,
} from './utils'
export type {
  NoInfer,
  IsAny,
  PickAsRequired,
  PickRequired,
  PickOptional,
  WithoutEmpty,
  Expand,
  DeepPartial,
  MakeDifferenceOptional,
  IsUnion,
  IsNonEmptyObject,
  Assign,
  IntersectAssign,
  Timeout,
  Updater,
  NonNullableUpdater,
  StringLiteral,
  ThrowOrOptional,
  ThrowConstraint,
  ControlledPromise,
  ExtractObjects,
  PartialMergeAllObject,
  MergeAllPrimitive,
  ExtractPrimitives,
  PartialMergeAll,
  Constrain,
  ConstrainLiteral,
  UnionToIntersection,
  MergeAllObjects,
  MergeAll,
  ValidateJSON,
  StrictOrFrom,
  LooseReturnType,
  LooseAsyncReturnType,
  Awaitable,
} from './utils'

export type {
  StandardSchemaValidatorProps,
  StandardSchemaValidator,
  AnyStandardSchemaValidator,
  StandardSchemaValidatorTypes,
  AnyStandardSchemaValidateSuccess,
  AnyStandardSchemaValidateFailure,
  AnyStandardSchemaValidateIssue,
  AnyStandardSchemaValidateInput,
  AnyStandardSchemaValidate,
  ValidatorObj,
  AnyValidatorObj,
  ValidatorAdapter,
  AnyValidatorAdapter,
  AnyValidatorFn,
  ValidatorFn,
  Validator,
  AnyValidator,
  AnySchema,
  DefaultValidator,
  ResolveSearchValidatorInputFn,
  ResolveSearchValidatorInput,
  ResolveValidatorInputFn,
  ResolveValidatorInput,
  ResolveValidatorOutputFn,
  ResolveValidatorOutput,
} from './validators'

export type {
  UseRouteContextBaseOptions,
  UseRouteContextOptions,
  UseRouteContextResult,
} from './useRouteContext'

export type { UseSearchResult, ResolveUseSearch } from './useSearch'

export type { UseParamsResult, ResolveUseParams } from './useParams'

export type { UseNavigateResult } from './useNavigate'

export type { UseLoaderDepsResult, ResolveUseLoaderDeps } from './useLoaderDeps'

export type { UseLoaderDataResult, ResolveUseLoaderData } from './useLoaderData'

export type {
  Redirect,
  RedirectOptions,
  RedirectOptionsRoute,
  RedirectFnRoute,
  ResolvedRedirect,
  AnyRedirect,
} from './redirect'

export {
  redirect,
  isRedirect,
  isResolvedRedirect,
  parseRedirect,
} from './redirect'

export type { NotFoundError } from './not-found'
export { isNotFound, notFound } from './not-found'

export {
  defaultGetScrollRestorationKey,
  getElementScrollRestorationEntry,
  storageKey,
  setupScrollRestoration,
} from './scroll-restoration'

export type {
  ScrollRestorationOptions,
  ScrollRestorationEntry,
} from './scroll-restoration'

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
} from './typePrimitives'

export type {
  AnySerializationAdapter,
  SerializationAdapter,
  ValidateSerializableInput,
  SerializerExtensions,
  ValidateSerializable,
  RegisteredSerializableInput,
  SerializableExtensions,
  DefaultSerializable,
  Serializable,
  TSR_SERIALIZABLE,
  TsrSerializable,
  SerializationError,
} from './ssr/serializer/transformer'

export {
  createSerializationAdapter,
  makeSerovalPlugin,
  makeSsrSerovalPlugin,
} from './ssr/serializer/transformer'

export { defaultSerovalPlugins } from './ssr/serializer/seroval-plugins'

export {
  RawStream,
  createRawStreamRPCPlugin,
  createRawStreamDeserializePlugin,
} from './ssr/serializer/RawStream'
export type {
  OnRawStreamCallback,
  RawStreamHint,
  RawStreamOptions,
} from './ssr/serializer/RawStream'

export { composeRewrites, executeRewriteInput } from './rewrite'
export type { LocationRewrite, LocationRewriteFunction } from './router'
