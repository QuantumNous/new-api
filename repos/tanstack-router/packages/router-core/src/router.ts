import { createBrowserHistory, parseHref } from '@tanstack/history'
import { isServer } from '@tanstack/router-core/isServer'
import {
  DEFAULT_PROTOCOL_ALLOWLIST,
  createControlledPromise,
  decodePath,
  deepEqual,
  encodePathLikeUrl,
  findLast,
  functionalUpdate,
  hasKeys,
  isDangerousProtocol,
  last,
  nullReplaceEqualDeep,
  replaceEqualDeep,
} from './utils'
import {
  buildRouteBranch,
  findFlatMatch,
  findRouteMatch,
  findSingleMatch,
  processRouteMasks,
  processRouteTree,
} from './new-process-route-tree'
import {
  cleanPath,
  compileDecodeCharMap,
  interpolatePath,
  resolvePath,
  trimPath,
  trimPathRight,
} from './path'
import { createLRUCache } from './lru-cache'
import { isNotFound } from './not-found'
import { setupScrollRestoration } from './scroll-restoration'
import { defaultParseSearch, defaultStringifySearch } from './searchParams'
import { rootRouteId } from './root'
import { isRedirect, redirect } from './redirect'
import { loadMatches, loadRouteChunk, routeNeedsPreload } from './load-matches'
import {
  composeRewrites,
  executeRewriteInput,
  executeRewriteOutput,
  rewriteBasepath,
} from './rewrite'
import { createRouterStores } from './stores'
import type { LRUCache } from './lru-cache'
import type {
  ProcessRouteTreeResult,
  ProcessedTree,
} from './new-process-route-tree'
import type { SearchParser, SearchSerializer } from './searchParams'
import type { AnyRedirect, ResolvedRedirect } from './redirect'
import type {
  HistoryAction,
  HistoryLocation,
  HistoryState,
  ParsedHistoryState,
  RouterHistory,
} from '@tanstack/history'

import type {
  Awaitable,
  Constrain,
  ControlledPromise,
  NoInfer,
  NonNullableUpdater,
  PickAsRequired,
  Updater,
} from './utils'
import type { ParsedLocation } from './location'
import type {
  AnyContext,
  AnyRoute,
  AnyRouteWithContext,
  LoaderStaleReloadMode,
  MakeRemountDepsOptionsUnion,
  RouteContextOptions,
  RouteLike,
  RouteMask,
  SearchMiddleware,
  SearchMiddlewareMeta,
} from './route'
import type {
  FullSearchSchema,
  RouteById,
  RoutePaths,
  RoutesById,
  RoutesByPath,
} from './routeInfo'
import type {
  AnyRouteMatch,
  MakeRouteMatch,
  MakeRouteMatchUnion,
  MatchRouteOptions,
} from './Matches'
import type {
  BuildLocationFn,
  CommitLocationOptions,
  NavigateFn,
} from './RouterProvider'
import type {
  Manifest,
  ManifestRouteAssets,
  RouterManagedTag,
} from './manifest'
import type { AnySchema, AnyValidator } from './validators'
import type { NavigateOptions, ResolveRelativePath, ToOptions } from './link'
import type { NotFoundError } from './not-found'
import type {
  AnySerializationAdapter,
  ValidateSerializableInput,
} from './ssr/serializer/transformer'
import type { GetStoreConfig, RouterStores } from './stores'

export type ControllablePromise<T = any> = Promise<T> & {
  resolve: (value: T) => void
  reject: (value?: any) => void
}

export type InjectedHtmlEntry = Promise<string>

export interface Register {
  // Lots of things on here like...
  // router
  // config
  // ssr
}

export type RegisteredSsr<TRegister = Register> = TRegister extends {
  ssr: infer TSSR
}
  ? TSSR
  : false

export type RegisteredRouter<TRegister = Register> = TRegister extends {
  router: infer TRouter
}
  ? TRouter
  : AnyRouter

export type RegisteredConfigType<TRegister, TKey> = TRegister extends {
  config: infer TConfig
}
  ? TConfig extends {
      '~types': infer TTypes
    }
    ? TKey extends keyof TTypes
      ? TTypes[TKey]
      : unknown
    : unknown
  : unknown

export type DefaultRemountDepsFn<TRouteTree extends AnyRoute> = (
  opts: MakeRemountDepsOptionsUnion<TRouteTree>,
) => any

export interface DefaultRouterOptionsExtensions {}

export interface RouterOptionsExtensions extends DefaultRouterOptionsExtensions {}

export type SSROption = boolean | 'data-only'

export interface RouterOptions<
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption,
  TDefaultStructuralSharingOption extends boolean = false,
  TRouterHistory extends RouterHistory = RouterHistory,
  TDehydrated = undefined,
> extends RouterOptionsExtensions {
  /**
   * The history object that will be used to manage the browser history.
   *
   * If not provided, a new createBrowserHistory instance will be created and used.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#history-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/history-types)
   */
  history?: TRouterHistory
  /**
   * A function that will be used to stringify search params when generating links.
   *
   * @default defaultStringifySearch
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#stringifysearch-method)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/custom-search-param-serialization)
   */
  stringifySearch?: SearchSerializer
  /**
   * A function that will be used to parse search params when parsing the current location.
   *
   * @default defaultParseSearch
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#parsesearch-method)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/custom-search-param-serialization)
   */
  parseSearch?: SearchParser
  /**
   * If `false`, routes will not be preloaded by default in any way.
   *
   * If `'intent'`, routes will be preloaded by default when the user hovers over a link or a `touchstart` event is detected on a `<Link>`.
   *
   * If `'viewport'`, routes will be preloaded by default when they are within the viewport.
   *
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpreload-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/preloading)
   */
  defaultPreload?: false | 'intent' | 'viewport' | 'render'
  /**
   * The delay in milliseconds that a route must be hovered over or touched before it is preloaded.
   *
   * @default 50
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpreloaddelay-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/preloading#preload-delay)
   */
  defaultPreloadDelay?: number
  /**
   * The default `preloadIntentProximity` a route should use if no preloadIntentProximity is provided.
   *
   * @default 0
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpreloadintentproximity-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/preloading#preload-intent-proximity)
   */
  defaultPreloadIntentProximity?: number
  /**
   * The default `pendingMs` a route should use if no pendingMs is provided.
   *
   * @default 1000
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpendingms-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#avoiding-pending-component-flash)
   */
  defaultPendingMs?: number
  /**
   * The default `pendingMinMs` a route should use if no pendingMinMs is provided.
   *
   * @default 500
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpendingminms-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#avoiding-pending-component-flash)
   */
  defaultPendingMinMs?: number
  /**
   * The default `staleTime` a route should use if no staleTime is provided. This is the time in milliseconds that a route will be considered fresh.
   *
   * @default 0
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultstaletime-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#key-options)
   */
  defaultStaleTime?: number
  /**
   * The default stale reload mode a route loader should use if no `loader.staleReloadMode` is provided.
   *
   * `'background'` preserves the current stale-while-revalidate behavior.
   * `'blocking'` waits for stale loader reloads to complete before resolving navigation.
   *
   * @default 'background'
   */
  defaultStaleReloadMode?: LoaderStaleReloadMode
  /**
   * The default `preloadStaleTime` a route should use if no preloadStaleTime is provided.
   *
   * @default 30_000 `(30 seconds)`
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpreloadstaletime-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/preloading)
   */
  defaultPreloadStaleTime?: number
  /**
   * The default `defaultPreloadGcTime` a route should use if no preloadGcTime is provided.
   *
   * @default 1_800_000 `(30 minutes)`
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultpreloadgctime-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/preloading)
   */
  defaultPreloadGcTime?: number
  /**
   * If `true`, route navigations will called using `document.startViewTransition()`.
   *
   * If the browser does not support this api, this option will be ignored.
   *
   * See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) for more information on how this function works.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultviewtransition-property)
   */
  defaultViewTransition?: boolean | ViewTransitionOptions
  /**
   * The default `hashScrollIntoView` a route should use if no hashScrollIntoView is provided while navigating
   *
   * See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) for more information on `ScrollIntoViewOptions`.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaulthashscrollintoview-property)
   */
  defaultHashScrollIntoView?: boolean | ScrollIntoViewOptions
  /**
   * @default 'fuzzy'
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#notfoundmode-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors#the-notfoundmode-option)
   */
  notFoundMode?: 'root' | 'fuzzy'
  /**
   * The default `gcTime` a route should use if no gcTime is provided.
   *
   * @default 1_800_000 `(30 minutes)`
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultgctime-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#key-options)
   */
  defaultGcTime?: number
  /**
   * If `true`, all routes will be matched as case-sensitive.
   *
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#casesensitive-property)
   */
  caseSensitive?: boolean
  /**
   *
   * The route tree that will be used to configure the router instance.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#routetree-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/routing/route-trees)
   */
  routeTree?: TRouteTree
  /**
   * The basepath for then entire router. This is useful for mounting a router instance at a subpath.
   * ```
   * @default '/'
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#basepath-property)
   */
  basepath?: string
  /**
   * The root context that will be provided to all routes in the route tree.
   *
   * This can be used to provide a context to all routes in the tree without having to provide it to each route individually.
   *
   * Optional or required if the root route was created with [`createRootRouteWithContext()`](https://tanstack.com/router/latest/docs/framework/react/api/router/createRootRouteWithContextFunction).
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#context-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/router-context)
   */
  context?: InferRouterContext<TRouteTree>

  additionalContext?: any

  /**
   * A function that will be called when the router is dehydrated.
   *
   * The return value of this function will be serialized and stored in the router's dehydrated state.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#dehydrate-method)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading#critical-dehydrationhydration)
   */
  dehydrate?: () => Awaitable<
    Constrain<TDehydrated, ValidateSerializableInput<Register, TDehydrated>>
  >
  /**
   * A function that will be called when the router is hydrated.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#hydrate-method)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading#critical-dehydrationhydration)
   */
  hydrate?: (dehydrated: TDehydrated) => Awaitable<void>
  /**
   * An array of route masks that will be used to mask routes in the route tree.
   *
   * Route masking is when you display a route at a different path than the one it is configured to match, like a modal popup that when shared will unmask to the modal's content instead of the modal's context.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#routemasks-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/route-masking)
   */
  routeMasks?: Array<RouteMask<TRouteTree>>
  /**
   * If `true`, route masks will, by default, be removed when the page is reloaded.
   *
   * This can be overridden on a per-mask basis by setting the `unmaskOnReload` option on the mask, or on a per-navigation basis by setting the `unmaskOnReload` option in the `Navigate` options.
   *
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#unmaskonreload-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/route-masking#unmasking-on-page-reload)
   */
  unmaskOnReload?: boolean

  /**
   * Use `notFoundComponent` instead.
   *
   * @deprecated
   * See https://tanstack.com/router/v1/docs/guide/not-found-errors#migrating-from-notfoundroute for more info.
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#notfoundroute-property)
   */
  notFoundRoute?: AnyRoute
  /**
   * Configures how trailing slashes are treated.
   *
   * - `'always'` will add a trailing slash if not present
   * - `'never'` will remove the trailing slash if present
   * - `'preserve'` will not modify the trailing slash.
   *
   * @default 'never'
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#trailingslash-property)
   */
  trailingSlash?: TTrailingSlashOption
  /**
   * While usually automatic, sometimes it can be useful to force the router into a server-side state, e.g. when using the router in a non-browser environment that has access to a global.document object.
   *
   * @default typeof document !== 'undefined'
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#isserver-property)
   */
  isServer?: boolean

  /**
   * @default false
   */
  isShell?: boolean

  /**
   * @default false
   */
  isPrerendering?: boolean

  /**
   * The default `ssr` a route should use if no `ssr` is provided.
   *
   * @default true
   */
  defaultSsr?: SSROption

  search?: {
    /**
     * Configures how unknown search params (= not returned by any `validateSearch`) are treated.
     *
     * @default false
     * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#search.strict-property)
     */
    strict?: boolean
  }

  /**
   * Configures whether structural sharing is enabled by default for fine-grained selectors.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#defaultstructuralsharing-property)
   */
  defaultStructuralSharing?: TDefaultStructuralSharingOption

  /**
   * Configures which URI characters are allowed in path params that would ordinarily be escaped by encodeURIComponent.
   *
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#pathparamsallowedcharacters-property)
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/path-params#allowed-characters)
   */
  pathParamsAllowedCharacters?: Array<
    ';' | ':' | '@' | '&' | '=' | '+' | '$' | ','
  >

  defaultRemountDeps?: DefaultRemountDepsFn<TRouteTree>

  /**
   * If `true`, scroll restoration will be enabled
   *
   * @default false
   */
  scrollRestoration?:
    | boolean
    | ((opts: { location: ParsedLocation }) => boolean)

  /**
   * A function that will be called to get the key for the scroll restoration cache.
   *
   * @default (location) => location.href
   */
  getScrollRestorationKey?: (location: ParsedLocation) => string
  /**
   * The default behavior for scroll restoration.
   *
   * @default 'auto'
   */
  scrollRestorationBehavior?: ScrollBehavior
  /**
   * An array of selectors that will be used to scroll to the top of the page in addition to `window`
   *
   * @default ['window']
   */
  scrollToTopSelectors?: Array<string | (() => Element | null | undefined)>

  /**
   * When `true`, disables the global catch boundary that normally wraps all route matches.
   * This allows unhandled errors to bubble up to top-level error handlers in the browser.
   *
   * Useful for testing tools (like Storybook Test Runner), error reporting services,
   * and debugging scenarios where you want errors to reach the browser's global error handlers.
   *
   * @default false
   */
  disableGlobalCatchBoundary?: boolean

  /**
   * An array of URL protocols to allow in links, redirects, and navigation.
   * Absolute URLs with protocols not in this list will be rejected.
   *
   * @default DEFAULT_PROTOCOL_ALLOWLIST (http:, https:, mailto:, tel:)
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#protocolallowlist-property)
   */
  protocolAllowlist?: Array<string>

  serializationAdapters?: ReadonlyArray<AnySerializationAdapter>
  /**
   * Configures how the router will rewrite the location between the actual href and the internal href of the router.
   *
   * @default undefined
   * @description You can provide a custom rewrite pair (in/out).
   * This is useful for shifting data from the origin to the path (for things like subdomain routing), or other advanced use cases.
   */
  rewrite?: LocationRewrite
  origin?: string
  ssr?: {
    nonce?: string
  }
}

export type LocationRewrite = {
  /**
   * A function that will be called to rewrite the URL before it is interpreted by the router from the history instance.
   *
   * @default undefined
   */
  input?: LocationRewriteFunction
  /**
   * A function that will be called to rewrite the URL before it is committed to the actual history instance from the router.
   *
   * @default undefined
   */
  output?: LocationRewriteFunction
}

/**
 * A function that will be called to rewrite the URL.
 *
 * @param url The URL to rewrite.
 * @returns The rewritten URL (as a URL instance or full href string) or undefined if no rewrite is needed.
 */
export type LocationRewriteFunction = ({
  url,
}: {
  url: URL
}) => undefined | string | URL

export interface RouterState<
  in out TRouteTree extends AnyRoute = AnyRoute,
  in out TRouteMatch = MakeRouteMatchUnion,
> {
  status: 'pending' | 'idle'
  loadedAt: number
  isLoading: boolean
  isTransitioning: boolean
  matches: Array<TRouteMatch>
  location: ParsedLocation<FullSearchSchema<TRouteTree>>
  resolvedLocation?: ParsedLocation<FullSearchSchema<TRouteTree>>
  statusCode: number
  redirect?: AnyRedirect
}

export interface BuildNextOptions {
  to?: string | number | null
  params?: true | Updater<unknown>
  search?: true | Updater<unknown>
  hash?: true | Updater<string>
  state?: true | NonNullableUpdater<ParsedHistoryState, HistoryState>
  mask?: {
    to?: string | number | null
    params?: true | Updater<unknown>
    search?: true | Updater<unknown>
    hash?: true | Updater<string>
    state?: true | NonNullableUpdater<ParsedHistoryState, HistoryState>
    unmaskOnReload?: boolean
  }
  from?: string
  href?: string
  _fromLocation?: ParsedLocation
  unsafeRelative?: 'path'
  _isNavigate?: boolean
}

type NavigationEventInfo = {
  fromLocation?: ParsedLocation
  toLocation: ParsedLocation
  pathChanged: boolean
  hrefChanged: boolean
  hashChanged: boolean
}

export interface RouterEvents {
  onBeforeNavigate: {
    type: 'onBeforeNavigate'
  } & NavigationEventInfo
  onBeforeLoad: {
    type: 'onBeforeLoad'
  } & NavigationEventInfo
  onLoad: {
    type: 'onLoad'
  } & NavigationEventInfo
  onResolved: {
    type: 'onResolved'
  } & NavigationEventInfo
  onBeforeRouteMount: {
    type: 'onBeforeRouteMount'
  } & NavigationEventInfo
  onRendered: {
    type: 'onRendered'
  } & NavigationEventInfo
}

export type RouterEvent = RouterEvents[keyof RouterEvents]

export type ListenerFn<TEvent extends RouterEvent> = (event: TEvent) => void

export type RouterListener<TRouterEvent extends RouterEvent> = {
  eventType: TRouterEvent['type']
  fn: ListenerFn<TRouterEvent>
}

export type SubscribeFn = <TType extends keyof RouterEvents>(
  eventType: TType,
  fn: ListenerFn<RouterEvents[TType]>,
) => () => void

export interface MatchRoutesOpts {
  preload?: boolean
  throwOnError?: boolean
  dest?: BuildNextOptions
}

export type InferRouterContext<TRouteTree extends AnyRoute> =
  TRouteTree['types']['routerContext']

export type RouterContextOptions<TRouteTree extends AnyRoute> =
  AnyContext extends InferRouterContext<TRouteTree>
    ? {
        context?: InferRouterContext<TRouteTree>
      }
    : {
        context: InferRouterContext<TRouteTree>
      }

export type RouterConstructorOptions<
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption,
  TDefaultStructuralSharingOption extends boolean,
  TRouterHistory extends RouterHistory,
  TDehydrated extends Record<string, any>,
> = Omit<
  RouterOptions<
    TRouteTree,
    TTrailingSlashOption,
    TDefaultStructuralSharingOption,
    TRouterHistory,
    TDehydrated
  >,
  'context' | 'serializationAdapters' | 'defaultSsr'
> &
  RouterContextOptions<TRouteTree>

export type PreloadRouteFn<
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption,
  TDefaultStructuralSharingOption extends boolean,
  TRouterHistory extends RouterHistory,
> = <
  TFrom extends RoutePaths<TRouteTree> | string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends RoutePaths<TRouteTree> | string = TFrom,
  TMaskTo extends string = '',
>(
  opts: NavigateOptions<
    RouterCore<
      TRouteTree,
      TTrailingSlashOption,
      TDefaultStructuralSharingOption,
      TRouterHistory
    >,
    TFrom,
    TTo,
    TMaskFrom,
    TMaskTo
  > & {
    /**
     * @internal
     * A **trusted** built location that can be used to redirect to.
     */
    _builtLocation?: ParsedLocation
  },
) => Promise<Array<AnyRouteMatch> | undefined>

export type MatchRouteFn<
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption,
  TDefaultStructuralSharingOption extends boolean,
  TRouterHistory extends RouterHistory,
> = <
  TFrom extends RoutePaths<TRouteTree> = '/',
  TTo extends string | undefined = undefined,
  TResolved = ResolveRelativePath<TFrom, NoInfer<TTo>>,
>(
  location: ToOptions<
    RouterCore<
      TRouteTree,
      TTrailingSlashOption,
      TDefaultStructuralSharingOption,
      TRouterHistory
    >,
    TFrom,
    TTo
  >,
  opts?: MatchRouteOptions,
) => false | RouteById<TRouteTree, TResolved>['types']['allParams']

export type UpdateFn<
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption,
  TDefaultStructuralSharingOption extends boolean,
  TRouterHistory extends RouterHistory,
  TDehydrated extends Record<string, any>,
> = (
  newOptions: RouterConstructorOptions<
    TRouteTree,
    TTrailingSlashOption,
    TDefaultStructuralSharingOption,
    TRouterHistory,
    TDehydrated
  >,
) => void

export type InvalidateFn<TRouter extends AnyRouter> = (opts?: {
  filter?: (d: MakeRouteMatchUnion<TRouter>) => boolean
  sync?: boolean
  forcePending?: boolean
}) => Promise<void>

export type ParseLocationFn<TRouteTree extends AnyRoute> = (
  locationToParse: HistoryLocation,
  previousLocation?: ParsedLocation<FullSearchSchema<TRouteTree>>,
) => ParsedLocation<FullSearchSchema<TRouteTree>>

export type GetMatchRoutesFn = (pathname: string) => {
  matchedRoutes: ReadonlyArray<AnyRoute>
  /** exhaustive params, still in their string form */
  routeParams: Record<string, string>
  foundRoute: AnyRoute | undefined
  parseError?: unknown
}

export type EmitFn = (routerEvent: RouterEvent) => void

export type LoadFn = (opts?: {
  sync?: boolean
  action?: { type: HistoryAction }
}) => Promise<void>

export type CommitLocationFn = ({
  viewTransition,
  ignoreBlocker,
  ...next
}: ParsedLocation & CommitLocationOptions) => Promise<void>

export type StartTransitionFn = (fn: () => void) => void

export interface MatchRoutesFn {
  (
    pathname: string,
    locationSearch?: AnySchema,
    opts?: MatchRoutesOpts,
  ): Array<MakeRouteMatchUnion>
  /**
   * @deprecated use the following signature instead
   */
  (next: ParsedLocation, opts?: MatchRoutesOpts): Array<AnyRouteMatch>
  (
    pathnameOrNext: string | ParsedLocation,
    locationSearchOrOpts?: AnySchema | MatchRoutesOpts,
    opts?: MatchRoutesOpts,
  ): Array<AnyRouteMatch>
}

export type GetMatchFn = (matchId: string) => AnyRouteMatch | undefined

export type UpdateMatchFn = (
  id: string,
  updater: (match: AnyRouteMatch) => AnyRouteMatch,
) => void

export type LoadRouteChunkFn = (route: AnyRoute) => Promise<Array<void>>

export type ResolveRedirect = (err: AnyRedirect) => ResolvedRedirect

export type ClearCacheFn<TRouter extends AnyRouter> = (opts?: {
  filter?: (d: MakeRouteMatchUnion<TRouter>) => boolean
}) => void

export interface ServerSsr {
  /** Framework-only: injects router-owned HTML into the SSR stream. */
  injectHtml: (html: string) => void
  /** Framework-only: injects a router-owned script tag into the SSR stream. */
  injectScript: (script: string) => void
  isDehydrated: () => boolean
  isSerializationFinished: () => boolean
  /** Framework-only: atomically reserves the pass-through stream path if safe. */
  reserveStreamFastPath: () => boolean
  /** Framework-only. */
  onInjectedHtml: (listener: () => void) => () => void
  /** Framework-only. */
  onRenderFinished: (listener: () => void) => void
  /** Framework-only. */
  setRenderFinished: () => void
  /** Framework-only. */
  cleanup: () => void
  /**
   * Register a listener invoked when the SSR request lifecycle ends (success,
   * error, abort, or stream lifetime expiry). Use to tear down per-request
   * resources whose references would otherwise pin the router (e.g. query
   * cache subscriptions, gcTime timers, abort controllers).
   *
   * Listeners run synchronously and exactly once. Errors are caught and logged.
   */
  onCleanup: (listener: () => void) => void
  /** Framework-only. */
  onSerializationFinished: (listener: () => void) => () => void
  /** Framework-only. */
  dehydrate: (opts?: { requestAssets?: ManifestRouteAssets }) => Promise<void>
  /** Framework-only. */
  takeBufferedScripts: () => RouterManagedTag | undefined
  /** Framework-only: takes buffered router-owned HTML. */
  takeBufferedHtml: () => string | undefined
  /** Framework-only. */
  liftScriptBarrier: () => void
}

export interface RouterSsrLifecycle {
  onServerSsrAttach?: Array<(serverSsr: ServerSsr) => void>
}

export type AnyRouterWithContext<TContext> = RouterCore<
  AnyRouteWithContext<TContext>,
  any,
  any,
  any,
  any
>

export type AnyRouter = RouterCore<any, any, any, any, any>

export interface ViewTransitionOptions {
  types:
    | Array<string>
    | ((locationChangeInfo: {
        fromLocation?: ParsedLocation
        toLocation: ParsedLocation
        pathChanged: boolean
        hrefChanged: boolean
        hashChanged: boolean
      }) => Array<string> | false)
}

// TODO where is this used? can we remove this?
/**
 * Convert an unknown error into a minimal, serializable object.
 * Includes name and message (and stack in development).
 */
export function defaultSerializeError(err: unknown) {
  if (err instanceof Error) {
    const obj = {
      name: err.name,
      message: err.message,
    }

    if (process.env.NODE_ENV === 'development') {
      ;(obj as any).stack = err.stack
    }

    return obj
  }

  return {
    data: err,
  }
}

/** Options for configuring trailing-slash behavior. */
export const trailingSlashOptions = {
  always: 'always',
  never: 'never',
  preserve: 'preserve',
} as const

export type TrailingSlashOption =
  (typeof trailingSlashOptions)[keyof typeof trailingSlashOptions]

/**
 * Compute whether path, href or hash changed between previous and current
 * resolved locations.
 */
export function getLocationChangeInfo(
  location: ParsedLocation,
  resolvedLocation?: ParsedLocation,
) {
  const fromLocation = resolvedLocation
  const toLocation = location
  const pathChanged = fromLocation?.pathname !== toLocation.pathname
  const hrefChanged = fromLocation?.href !== toLocation.href
  const hashChanged = fromLocation?.hash !== toLocation.hash
  return { fromLocation, toLocation, pathChanged, hrefChanged, hashChanged }
}

type LightweightRouteMatchResult = {
  matchedRoutes: ReadonlyArray<AnyRoute>
  fullPath: string
  search: Record<string, unknown>
  params: Record<string, unknown>
}

type LightweightRouteMatchCacheEntry = [
  lastMatchId: string | undefined,
  result: LightweightRouteMatchResult,
]

export type CreateRouterFn = <
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption = 'never',
  TDefaultStructuralSharingOption extends boolean = false,
  TRouterHistory extends RouterHistory = RouterHistory,
  TDehydrated extends Record<string, any> = Record<string, any>,
>(
  options: undefined extends number
    ? 'strictNullChecks must be enabled in tsconfig.json'
    : RouterConstructorOptions<
        TRouteTree,
        TTrailingSlashOption,
        TDefaultStructuralSharingOption,
        TRouterHistory,
        TDehydrated
      >,
) => RouterCore<
  TRouteTree,
  TTrailingSlashOption,
  TDefaultStructuralSharingOption,
  TRouterHistory,
  TDehydrated
>

declare global {
  // eslint-disable-next-line no-var
  var __TSR_CACHE__:
    | {
        routeTree: AnyRoute
        processRouteTreeResult: ProcessRouteTreeResult<AnyRoute>
        resolvePathCache: LRUCache<string, string>
      }
    | undefined
}

/**
 * Core, framework-agnostic router engine that powers TanStack Router.
 *
 * Provides navigation, matching, loading, preloading, caching and event APIs
 * used by framework adapters (React/Solid). Prefer framework helpers like
 * `createRouter` in app code.
 *
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/RouterType
 */
export class RouterCore<
  in out TRouteTree extends AnyRoute,
  in out TTrailingSlashOption extends TrailingSlashOption,
  in out TDefaultStructuralSharingOption extends boolean,
  in out TRouterHistory extends RouterHistory = RouterHistory,
  in out TDehydrated extends Record<string, any> = Record<string, any>,
> {
  // Option-independent properties
  tempLocationKey: string | undefined = `${Math.round(
    Math.random() * 10000000,
  )}`
  _scroll: {
    next: boolean
    // True until the current PUSH/REPLACE renders, so its hash owns window scroll.
    hash?: boolean
    restoring?: boolean
    restoration?: boolean
    reset?: boolean
  } = { next: true }
  shouldViewTransition?: boolean | ViewTransitionOptions = undefined
  isViewTransitionTypesSupported?: boolean = undefined
  subscribers = new Set<RouterListener<RouterEvent>>()
  viewTransitionPromise?: ControlledPromise<true>

  // Must build in constructor
  stores!: RouterStores<TRouteTree>
  private getStoreConfig!: GetStoreConfig
  batch!: (fn: () => void) => void

  options!: PickAsRequired<
    RouterOptions<
      TRouteTree,
      TTrailingSlashOption,
      TDefaultStructuralSharingOption,
      TRouterHistory,
      TDehydrated
    >,
    'stringifySearch' | 'parseSearch' | 'context'
  >
  history!: TRouterHistory
  rewrite?: LocationRewrite
  origin?: string
  latestLocation!: ParsedLocation<FullSearchSchema<TRouteTree>>
  pendingBuiltLocation?: ParsedLocation<FullSearchSchema<TRouteTree>>
  basepath!: string
  routeTree!: TRouteTree
  routesById!: RoutesById<TRouteTree>
  routesByPath!: RoutesByPath<TRouteTree>
  processedTree!: ProcessedTree<TRouteTree, any, any>
  resolvePathCache!: LRUCache<string, string>
  private routeBranchCache = new WeakMap<AnyRoute, ReadonlyArray<AnyRoute>>()
  private lightweightCache = new WeakMap<
    ParsedLocation,
    LightweightRouteMatchCacheEntry
  >()
  isServer!: boolean
  pathParamsDecoder?: (encoded: string) => string
  protocolAllowlist!: Set<string>

  /**
   * @deprecated Use the `createRouter` function instead
   */
  constructor(
    options: RouterConstructorOptions<
      TRouteTree,
      TTrailingSlashOption,
      TDefaultStructuralSharingOption,
      TRouterHistory,
      TDehydrated
    >,
    getStoreConfig: GetStoreConfig,
  ) {
    this.getStoreConfig = getStoreConfig

    this.update({
      defaultPreloadDelay: 50,
      defaultPendingMs: 1000,
      defaultPendingMinMs: 500,
      context: undefined!,
      ...options,
      caseSensitive: options.caseSensitive ?? false,
      notFoundMode: options.notFoundMode ?? 'fuzzy',
      stringifySearch: options.stringifySearch ?? defaultStringifySearch,
      parseSearch: options.parseSearch ?? defaultParseSearch,
      protocolAllowlist:
        options.protocolAllowlist ?? DEFAULT_PROTOCOL_ALLOWLIST,
    })

    if (typeof document !== 'undefined') {
      self.__TSR_ROUTER__ = this
    }
  }

  // This is a default implementation that can optionally be overridden
  // by the router provider once rendered. We provide this so that the
  // router can be used in a non-react environment if necessary
  startTransition: StartTransitionFn = (fn) => fn()

  isShell() {
    return !!this.options.isShell
  }

  isPrerendering() {
    return !!this.options.isPrerendering
  }

  update: UpdateFn<
    TRouteTree,
    TTrailingSlashOption,
    TDefaultStructuralSharingOption,
    TRouterHistory,
    TDehydrated
  > = (newOptions) => {
    if (process.env.NODE_ENV !== 'production') {
      if (newOptions.notFoundRoute) {
        console.warn(
          'The notFoundRoute API is deprecated and will be removed in the next major version. See https://tanstack.com/router/v1/docs/framework/react/guide/not-found-errors#migrating-from-notfoundroute for more info.',
        )
      }
    }

    const prevOptions = this.options
    const prevBasepath = this.basepath ?? prevOptions?.basepath ?? '/'
    const basepathWasUnset = this.basepath === undefined
    const prevRewriteOption = prevOptions?.rewrite

    this.options = {
      ...prevOptions,
      ...newOptions,
    }

    this.isServer = this.options.isServer ?? typeof document === 'undefined'

    this.protocolAllowlist = new Set(this.options.protocolAllowlist)

    if (this.options.pathParamsAllowedCharacters)
      this.pathParamsDecoder = compileDecodeCharMap(
        this.options.pathParamsAllowedCharacters,
      )

    if (
      !this.history ||
      (this.options.history && this.options.history !== this.history)
    ) {
      if (!this.options.history) {
        if (!(isServer ?? this.isServer)) {
          this.history = createBrowserHistory() as TRouterHistory
        }
      } else {
        this.history = this.options.history
      }
    }

    this.origin = this.options.origin
    if (!this.origin) {
      if (
        !(isServer ?? this.isServer) &&
        window?.origin &&
        window.origin !== 'null'
      ) {
        this.origin = window.origin
      } else {
        // fallback for the server, can be overridden by calling router.update({origin}) on the server
        this.origin = 'http://localhost'
      }
    }

    if (this.history) {
      this.updateLatestLocation()
    }

    if (this.options.routeTree !== this.routeTree) {
      this.routeTree = this.options.routeTree as TRouteTree
      let processRouteTreeResult: ProcessRouteTreeResult<TRouteTree>
      if (
        (isServer ?? this.isServer) &&
        process.env.NODE_ENV !== 'development' &&
        globalThis.__TSR_CACHE__ &&
        globalThis.__TSR_CACHE__.routeTree === this.routeTree
      ) {
        const cached = globalThis.__TSR_CACHE__
        this.resolvePathCache = cached.resolvePathCache
        processRouteTreeResult = cached.processRouteTreeResult as any
      } else {
        this.resolvePathCache = createLRUCache(1000)
        processRouteTreeResult = this.buildRouteTree()
        // only cache if nothing else is cached yet
        if (
          (isServer ?? this.isServer) &&
          process.env.NODE_ENV !== 'development' &&
          globalThis.__TSR_CACHE__ === undefined
        ) {
          globalThis.__TSR_CACHE__ = {
            routeTree: this.routeTree,
            processRouteTreeResult: processRouteTreeResult as any,
            resolvePathCache: this.resolvePathCache,
          }
        }
      }
      this.setRoutes(processRouteTreeResult)
    }

    if (!this.stores && this.latestLocation) {
      const config = this.getStoreConfig(this)
      this.batch = config.batch
      this.stores = createRouterStores(
        getInitialRouterState(this.latestLocation),
        config,
      )

      if (!(isServer ?? this.isServer)) {
        setupScrollRestoration(this)
      }
    }

    let needsLocationUpdate = false
    const nextBasepath = this.options.basepath ?? '/'
    const nextRewriteOption = this.options.rewrite
    const basepathChanged = basepathWasUnset || prevBasepath !== nextBasepath
    const rewriteChanged = prevRewriteOption !== nextRewriteOption

    if (basepathChanged || rewriteChanged) {
      this.basepath = nextBasepath

      const rewrites: Array<LocationRewrite> = []
      const trimmed = trimPath(nextBasepath)
      if (trimmed && trimmed !== '/') {
        rewrites.push(
          rewriteBasepath({
            basepath: nextBasepath,
          }),
        )
      }
      if (nextRewriteOption) {
        rewrites.push(nextRewriteOption)
      }

      this.rewrite =
        rewrites.length === 0
          ? undefined
          : rewrites.length === 1
            ? rewrites[0]
            : composeRewrites(rewrites)

      if (this.history) {
        this.updateLatestLocation()
      }

      needsLocationUpdate = true
    }

    if (needsLocationUpdate && this.stores) {
      this.stores.location.set(this.latestLocation)
    }

    if (
      typeof window !== 'undefined' &&
      'CSS' in window &&
      typeof window.CSS?.supports === 'function'
    ) {
      this.isViewTransitionTypesSupported = window.CSS.supports(
        'selector(:active-view-transition-type(a))',
      )
    }
  }

  get state(): RouterState<TRouteTree> {
    return this.stores.__store.get()
  }

  updateLatestLocation = () => {
    this.latestLocation = this.parseLocation(
      this.history.location,
      this.latestLocation,
    )
  }

  buildRouteTree = () => {
    const result = processRouteTree(
      this.routeTree,
      this.options.caseSensitive,
      (route, i) => {
        route.init({
          originalIndex: i,
        })
      },
    )
    if (this.options.routeMasks) {
      processRouteMasks(this.options.routeMasks, result.processedTree)
    }

    return result
  }

  setRoutes({
    routesById,
    routesByPath,
    processedTree,
  }: ProcessRouteTreeResult<TRouteTree>) {
    this.routesById = routesById as RoutesById<TRouteTree>
    this.routesByPath = routesByPath as RoutesByPath<TRouteTree>
    this.processedTree = processedTree

    const notFoundRoute = this.options.notFoundRoute

    if (notFoundRoute) {
      notFoundRoute.init({
        originalIndex: 99999999999,
      })
      this.routesById[notFoundRoute.id] = notFoundRoute
    }
  }

  /**
   * Subscribe to router lifecycle events like `onBeforeNavigate`, `onLoad`,
   * `onResolved`, etc. Returns an unsubscribe function.
   *
   * @link https://tanstack.com/router/latest/docs/framework/react/api/router/RouterEventsType
   */
  subscribe: SubscribeFn = (eventType, fn) => {
    const listener: RouterListener<any> = {
      eventType,
      fn,
    }

    this.subscribers.add(listener)

    return () => {
      this.subscribers.delete(listener)
    }
  }

  emit: EmitFn = (routerEvent) => {
    this.subscribers.forEach((listener) => {
      if (listener.eventType === routerEvent.type) {
        listener.fn(routerEvent)
      }
    })
  }

  /**
   * Parse a HistoryLocation into a strongly-typed ParsedLocation using the
   * current router options, rewrite rules and search parser/stringifier.
   */
  parseLocation: ParseLocationFn<TRouteTree> = (
    locationToParse,
    previousLocation,
  ) => {
    const parse = ({
      pathname,
      search,
      hash,
      href,
      state,
    }: HistoryLocation): ParsedLocation<FullSearchSchema<TRouteTree>> => {
      // Fast path: no rewrite configured and pathname doesn't need encoding
      // Characters that need encoding: space, high unicode, control chars
      // eslint-disable-next-line no-control-regex
      if (!this.rewrite && !/[ \x00-\x1f\x7f\u0080-\uffff]/.test(pathname)) {
        const parsedSearch = this.options.parseSearch(search)
        const searchStr = this.options.stringifySearch(parsedSearch)

        return {
          href: pathname + searchStr + hash,
          publicHref: pathname + searchStr + hash,
          pathname: decodePath(pathname).path,
          external: false,
          searchStr,
          search: nullReplaceEqualDeep(
            previousLocation?.search,
            parsedSearch,
          ) as any,
          hash: decodePath(hash.slice(1)).path,
          state: replaceEqualDeep(previousLocation?.state, state),
        }
      }

      // Before we do any processing, we need to allow rewrites to modify the URL
      // build up the full URL by combining the href from history with the router's origin
      const fullUrl = new URL(href, this.origin)

      const url = executeRewriteInput(this.rewrite, fullUrl)

      const parsedSearch = this.options.parseSearch(url.search)
      const searchStr = this.options.stringifySearch(parsedSearch)
      // Make sure our final url uses the re-stringified pathname, search, and has for consistency
      // (We were already doing this, so just keeping it for now)
      url.search = searchStr

      const fullPath = url.href.replace(url.origin, '')

      return {
        href: fullPath,
        publicHref: href,
        pathname: decodePath(url.pathname).path,
        external: !!this.rewrite && url.origin !== this.origin,
        searchStr,
        search: nullReplaceEqualDeep(
          previousLocation?.search,
          parsedSearch,
        ) as any,
        hash: decodePath(url.hash.slice(1)).path,
        state: replaceEqualDeep(previousLocation?.state, state),
      }
    }

    const location = parse(locationToParse)

    const { __tempLocation, __tempKey } = location.state

    if (__tempLocation && (!__tempKey || __tempKey === this.tempLocationKey)) {
      // Sync up the location keys
      const parsedTempLocation = parse(__tempLocation) as any
      parsedTempLocation.state.key = location.state.key // TODO: Remove in v2 - use __TSR_key instead
      parsedTempLocation.state.__TSR_key = location.state.__TSR_key

      delete parsedTempLocation.state.__tempLocation

      return {
        ...parsedTempLocation,
        maskedLocation: location,
      }
    }
    return location
  }

  /** Resolve a path using the router's trailing-slash policy. */
  resolvePathWithBase = (from: string, path: string) => {
    return resolvePath({
      base: from,
      to: path.includes('//') ? cleanPath(path) : path,
      trailingSlash: this.options.trailingSlash,
      cache: this.resolvePathCache,
    })
  }

  private getRouteBranch(route: AnyRoute) {
    let branch = this.routeBranchCache.get(route)
    if (!branch) {
      branch = buildRouteBranch(route)
      this.routeBranchCache.set(route, branch)
    }
    return branch
  }

  get looseRoutesById() {
    return this.routesById as Record<string, AnyRoute>
  }

  matchRoutes: MatchRoutesFn = (
    pathnameOrNext: string | ParsedLocation,
    locationSearchOrOpts?: AnySchema | MatchRoutesOpts,
    opts?: MatchRoutesOpts,
  ) => {
    if (typeof pathnameOrNext === 'string') {
      return this.matchRoutesInternal(
        {
          pathname: pathnameOrNext,
          search: locationSearchOrOpts,
        } as ParsedLocation,
        opts,
      )
    }

    return this.matchRoutesInternal(pathnameOrNext, locationSearchOrOpts)
  }

  private getParentContext(parentMatch?: AnyRouteMatch) {
    const parentMatchId = parentMatch?.id

    const parentContext = !parentMatchId
      ? ((this.options.context as any) ?? undefined)
      : (parentMatch.context ?? this.options.context ?? undefined)

    return parentContext
  }

  private matchRoutesInternal(
    next: ParsedLocation,
    opts?: MatchRoutesOpts,
  ): Array<AnyRouteMatch> {
    const matchedRoutesResult = this.getMatchedRoutes(next.pathname)
    const { foundRoute, routeParams } = matchedRoutesResult
    let { matchedRoutes } = matchedRoutesResult
    let isGlobalNotFound = false

    // Check to see if the route needs a 404 entry
    if (
      // If we found a route, and it's not an index route and we have left over path
      foundRoute
        ? foundRoute.path !== '/' && routeParams['**']
        : // Or if we didn't find a route and we have left over path
          trimPathRight(next.pathname)
    ) {
      // If the user has defined an (old) 404 route, use it
      if (this.options.notFoundRoute) {
        matchedRoutes = [...matchedRoutes, this.options.notFoundRoute]
      } else {
        // If there is no routes found during path matching
        isGlobalNotFound = true
      }
    }

    const globalNotFoundRouteId = isGlobalNotFound
      ? findGlobalNotFoundRouteId(this.options.notFoundMode, matchedRoutes)
      : undefined

    const matches = new Array<AnyRouteMatch>(matchedRoutes.length)
    // Snapshot of active match state keyed by routeId, used to stabilise
    // params/search across navigations.
    const previousActiveMatchesByRouteId = new Map<string, AnyRouteMatch>()
    for (const store of this.stores.matchStores.values()) {
      if (store.routeId) {
        previousActiveMatchesByRouteId.set(store.routeId, store.get())
      }
    }

    for (let index = 0; index < matchedRoutes.length; index++) {
      const route = matchedRoutes[index]!
      // Take each matched route and resolve + validate its search params
      // This has to happen serially because each route's search params
      // can depend on the parent route's search params
      // It must also happen before we create the match so that we can
      // pass the search params to the route's potential key function
      // which is used to uniquely identify the route match in state

      const parentMatch = matches[index - 1]

      let preMatchSearch: Record<string, any>
      let strictMatchSearch: Record<string, any>
      let searchError: any
      {
        // Validate the search params and stabilize them
        const parentSearch = parentMatch?.search ?? next.search
        const parentStrictSearch = parentMatch?._strictSearch ?? undefined

        try {
          const strictSearch =
            validateSearch(route.options.validateSearch, { ...parentSearch }) ??
            undefined

          preMatchSearch = {
            ...parentSearch,
            ...strictSearch,
          }
          strictMatchSearch = { ...parentStrictSearch, ...strictSearch }
          searchError = undefined
        } catch (err: any) {
          let searchParamError = err
          if (!(err instanceof SearchParamError)) {
            searchParamError = new SearchParamError(err.message, {
              cause: err,
            })
          }

          if (opts?.throwOnError) {
            throw searchParamError
          }

          preMatchSearch = parentSearch
          strictMatchSearch = {}
          searchError = searchParamError
        }
      }

      // This is where we need to call route.options.loaderDeps() to get any additional
      // deps that the route's loader function might need to run. We need to do this
      // before we create the match so that we can pass the deps to the route's
      // potential key function which is used to uniquely identify the route match in state

      const loaderDeps =
        route.options.loaderDeps?.({
          search: preMatchSearch,
        }) ?? ''

      const loaderDepsHash = loaderDeps ? JSON.stringify(loaderDeps) : ''

      const { interpolatedPath, usedParams } = interpolatePath({
        path: route.fullPath,
        params: routeParams,
        decoder: this.pathParamsDecoder,
        server: this.isServer,
      })

      // Waste not, want not. If we already have a match for this route,
      // reuse it. This is important for layout routes, which might stick
      // around between navigation actions that only change leaf routes.

      // Existing matches are matches that are already loaded along with
      // pending matches that are still loading
      const matchId =
        // route.id for disambiguation
        route.id +
        // interpolatedPath for param changes
        interpolatedPath +
        // explicit deps
        loaderDepsHash

      const existingMatch = this.getMatch(matchId)

      const previousMatch = previousActiveMatchesByRouteId.get(route.id)

      const strictParams = existingMatch?._strictParams ?? usedParams

      let paramsError: unknown = undefined

      if (!existingMatch) {
        try {
          extractStrictParams(route, strictParams)
        } catch (err: any) {
          if (isNotFound(err) || isRedirect(err)) {
            paramsError = err
          } else {
            paramsError = new PathParamError(err.message, {
              cause: err,
            })
          }

          if (opts?.throwOnError) {
            throw paramsError
          }
        }
      }

      Object.assign(routeParams, strictParams)

      const cause = previousMatch ? 'stay' : 'enter'

      let match: AnyRouteMatch

      if (existingMatch) {
        match = {
          ...existingMatch,
          cause,
          params: previousMatch?.params ?? routeParams,
          _strictParams: strictParams,
          search: previousMatch
            ? nullReplaceEqualDeep(previousMatch.search, preMatchSearch)
            : nullReplaceEqualDeep(existingMatch.search, preMatchSearch),
          _strictSearch: strictMatchSearch,
        }
      } else {
        const status =
          route.options.loader ||
          route.options.beforeLoad ||
          route.lazyFn ||
          routeNeedsPreload(route)
            ? 'pending'
            : 'success'

        match = {
          id: matchId,
          ssr: (isServer ?? this.isServer) ? undefined : route.options.ssr,
          index,
          routeId: route.id,
          params: previousMatch?.params ?? routeParams,
          _strictParams: strictParams,
          pathname: interpolatedPath,
          updatedAt: Date.now(),
          search: previousMatch
            ? nullReplaceEqualDeep(previousMatch.search, preMatchSearch)
            : preMatchSearch,
          _strictSearch: strictMatchSearch,
          searchError: undefined,
          status,
          isFetching: false,
          error: undefined,
          paramsError,
          __routeContext: undefined,
          _nonReactive: {
            loadPromise: createControlledPromise(),
          },
          __beforeLoadContext: undefined,
          context: {},
          abortController: new AbortController(),
          fetchCount: 0,
          cause,
          loaderDeps: previousMatch
            ? replaceEqualDeep(previousMatch.loaderDeps, loaderDeps)
            : loaderDeps,
          invalid: false,
          preload: false,
          links: undefined,
          scripts: undefined,
          headScripts: undefined,
          meta: undefined,
          staticData: route.options.staticData || {},
          fullPath: route.fullPath,
        }
      }

      if (!opts?.preload) {
        // If we have a global not found, mark the right match as global not found
        match.globalNotFound = globalNotFoundRouteId === route.id
      }

      // update the searchError if there is one
      match.searchError = searchError

      const parentContext = this.getParentContext(parentMatch)

      match.context = {
        ...parentContext,
        ...match.__routeContext,
        ...match.__beforeLoadContext,
      }

      matches[index] = match
    }

    for (let index = 0; index < matches.length; index++) {
      const match = matches[index]!
      const route = this.looseRoutesById[match.routeId]!
      const existingMatch = this.getMatch(match.id)

      // Update the match's params
      const previousMatch = previousActiveMatchesByRouteId.get(match.routeId)
      match.params = previousMatch
        ? nullReplaceEqualDeep(previousMatch.params, routeParams)
        : routeParams

      if (!existingMatch) {
        const parentMatch = matches[index - 1]
        const parentContext = this.getParentContext(parentMatch)

        // Update the match's context

        if (route.options.context) {
          const contextFnContext: RouteContextOptions<any, any, any, any, any> =
            {
              deps: match.loaderDeps,
              params: match.params,
              context: parentContext ?? {},
              location: next,
              navigate: (opts: any) =>
                this.navigate({ ...opts, _fromLocation: next }),
              buildLocation: this.buildLocation,
              cause: match.cause,
              abortController: match.abortController,
              preload: !!match.preload,
              matches,
              routeId: route.id,
            }
          // Get the route context
          match.__routeContext =
            route.options.context(contextFnContext) ?? undefined
        }

        match.context = {
          ...parentContext,
          ...match.__routeContext,
          ...match.__beforeLoadContext,
        }
      }
    }

    return matches
  }

  getMatchedRoutes: GetMatchRoutesFn = (pathname) => {
    return getMatchedRoutes({
      pathname,
      routesById: this.routesById,
      processedTree: this.processedTree,
    })
  }

  /**
   * Lightweight route matching for buildLocation.
   * Only computes fullPath, accumulated search, and params - skipping expensive
   * operations like AbortController, ControlledPromise, loaderDeps, and full match objects.
   */
  private matchRoutesLightweight(
    location: ParsedLocation,
  ): LightweightRouteMatchResult {
    const lastStateMatchId = last(this.stores.matchesId.get())
    const cached = this.lightweightCache.get(location)
    if (cached && cached[0] === lastStateMatchId) {
      return cached[1]
    }

    const { matchedRoutes, routeParams } = this.getMatchedRoutes(
      location.pathname,
    )
    const lastRoute = last(matchedRoutes)!

    // I don't know if we should run the full search middleware chain, or just validateSearch
    // // Accumulate search validation through the route chain
    // const accumulatedSearch: Record<string, unknown> = applySearchMiddleware({
    //   search: { ...location.search },
    //   dest: location,
    //   destRoutes: matchedRoutes,
    //   _includeValidateSearch: true,
    // })

    // Accumulate search validation through route chain
    const accumulatedSearch = { ...location.search }
    for (const route of matchedRoutes) {
      try {
        Object.assign(
          accumulatedSearch,
          validateSearch(route.options.validateSearch, accumulatedSearch),
        )
      } catch {
        // Ignore errors, we're not actually routing
      }
    }

    // Determine params: reuse from state if possible, otherwise parse
    const lastStateMatch =
      lastStateMatchId && this.stores.matchStores.get(lastStateMatchId)?.get()
    const canReuseParams =
      lastStateMatch &&
      lastStateMatch.routeId === lastRoute.id &&
      lastStateMatch.pathname === location.pathname

    let params: Record<string, unknown>
    if (canReuseParams) {
      params = lastStateMatch.params
    } else {
      // Parse params through the route chain
      const strictParams: Record<string, unknown> = Object.assign(
        Object.create(null),
        routeParams,
      )
      for (const route of matchedRoutes) {
        try {
          extractStrictParams(route, strictParams)
        } catch {
          // Ignore errors, we're not actually routing
        }
      }
      params = strictParams
    }

    const result = {
      matchedRoutes,
      fullPath: lastRoute.fullPath,
      search: accumulatedSearch,
      params,
    }
    this.lightweightCache.set(location, [lastStateMatchId, result])
    return result
  }

  cancelMatch = (id: string) => {
    const match = this.getMatch(id)

    if (!match) return

    match.abortController.abort()
    clearTimeout(match._nonReactive.pendingTimeout)
    match._nonReactive.pendingTimeout = undefined
  }

  cancelMatches = () => {
    this.stores.pendingIds.get().forEach((matchId) => {
      this.cancelMatch(matchId)
    })

    this.stores.matchesId.get().forEach((matchId) => {
      if (this.stores.pendingMatchStores.has(matchId)) {
        return
      }

      const match = this.stores.matchStores.get(matchId)?.get()
      if (!match) {
        return
      }

      if (match.status === 'pending' || match.isFetching === 'loader') {
        this.cancelMatch(matchId)
      }
    })
  }

  /**
   * Build the next ParsedLocation from navigation options without committing.
   * Resolves `to`/`from`, params/search/hash/state, applies search validation
   * and middlewares, and returns a stable, stringified location object.
   *
   * @link https://tanstack.com/router/latest/docs/framework/react/api/router/RouterType#buildlocation-method
   */
  buildLocation: BuildLocationFn = (opts) => {
    const build = (
      dest: BuildNextOptions & {
        unmaskOnReload?: boolean
      } = {},
    ): ParsedLocation => {
      // We allow the caller to override the current location
      const currentLocation =
        dest._fromLocation || this.pendingBuiltLocation || this.latestLocation

      // Use lightweight matching - only computes what buildLocation needs
      // (fullPath, search, params) without creating full match objects
      const lightweightResult = this.matchRoutesLightweight(currentLocation)

      // check that from path exists in the current route tree
      // do this check only on navigations during test or development
      if (
        dest.from &&
        process.env.NODE_ENV !== 'production' &&
        dest._isNavigate
      ) {
        const allFromMatches = this.getMatchedRoutes(dest.from).matchedRoutes

        const matchedFrom = findLast(lightweightResult.matchedRoutes, (d) => {
          return comparePaths(d.fullPath, dest.from!)
        })

        const matchedCurrent = findLast(allFromMatches, (d) => {
          return comparePaths(d.fullPath, lightweightResult.fullPath)
        })

        // for from to be invalid it shouldn't just be unmatched to currentLocation
        // but the currentLocation should also be unmatched to from
        if (!matchedFrom && !matchedCurrent) {
          console.warn(`Could not find match for from: ${dest.from}`)
        }
      }

      const defaultedFromPath =
        dest.unsafeRelative === 'path'
          ? currentLocation.pathname
          : (dest.from ?? lightweightResult.fullPath)
      const destTo = dest.to ? `${dest.to}` : undefined

      // From search should always use the current location
      const fromSearch = lightweightResult.search
      // Same with params. It can't hurt to provide as many as possible
      const fromParams = Object.assign(
        Object.create(null),
        lightweightResult.params,
      )

      const isAbsoluteTo = destTo?.charCodeAt(0) === 47
      const sourcePath = isAbsoluteTo
        ? '/'
        : this.resolvePathWithBase(defaultedFromPath, '.')

      // Resolve the destination. Absolute destinations don't need the source path.
      const nextTo = destTo
        ? this.resolvePathWithBase(sourcePath, destTo)
        : sourcePath

      // Resolve the next params
      const nextParams =
        dest.params === false || dest.params === null
          ? Object.create(null)
          : (dest.params ?? true) === true
            ? fromParams
            : Object.assign(
                fromParams,
                functionalUpdate(dest.params as any, fromParams),
              )

      const destRoute = this.routesByPath[
        trimPathRight(nextTo) as keyof typeof this.routesByPath
      ] as AnyRoute | undefined

      let destRoutes: ReadonlyArray<AnyRoute>
      if (destRoute) {
        destRoutes = this.getRouteBranch(destRoute)
      } else if (nextTo.includes('$')) {
        // Route templates must match routesByPath exactly. A miss here is a
        // typed destination mismatch, not a concrete URL to route-match.
        destRoutes = []
      } else {
        const destMatchResult = this.getMatchedRoutes(nextTo)
        destRoutes = destMatchResult.matchedRoutes

        if (
          this.options.notFoundRoute &&
          (!destMatchResult.foundRoute ||
            (destMatchResult.foundRoute.path !== '/' &&
              destMatchResult.routeParams['**']))
        ) {
          destRoutes = [...destRoutes, this.options.notFoundRoute]
        }
      }

      // If there are any params, we need to stringify them
      if (destRoutes.length && hasKeys(nextParams)) {
        for (const route of destRoutes) {
          const fn =
            route.options.params?.stringify ?? route.options.stringifyParams
          if (fn) {
            try {
              Object.assign(nextParams, fn(nextParams))
            } catch {
              // Ignore errors here. When a paired parseParams is defined,
              // extractStrictParams will re-throw during route matching,
              // storing the error on the match and allowing the route's
              // errorComponent to render. If no parseParams is defined,
              // the stringify error is silently dropped.
            }
          }
        }
      }

      const nextPathname = opts.leaveParams
        ? // Keep path params uninterpolated for matchRoute/template matching.
          nextTo
        : decodePath(
            interpolatePath({
              path: nextTo,
              params: nextParams,
              decoder: this.pathParamsDecoder,
              server: this.isServer,
            }).interpolatedPath,
          ).path

      if (
        process.env.NODE_ENV !== 'production' &&
        destRoute &&
        !opts.leaveParams
      ) {
        try {
          const roundTrip = this.getMatchedRoutes(nextPathname)
          if (roundTrip.foundRoute?.id !== destRoute.id) {
            console.warn(
              `Generated path "${nextPathname}" for route "${destRoute.id}" matched route "${roundTrip.foundRoute?.id}" instead. This can happen when multiple route templates resolve to the same URL. Use the route template that matches the intended route, or adjust params.stringify if it changed the target path.`,
            )
          }
        } catch {
          // Ignore roundtrip validation errors. The generated location will be
          // handled by the normal navigation flow.
        }
      }

      // Resolve the next search
      let nextSearch = fromSearch
      if (opts._includeValidateSearch && this.options.search?.strict) {
        const validatedSearch = {}
        destRoutes.forEach((route) => {
          if (route.options.validateSearch) {
            try {
              Object.assign(
                validatedSearch,
                validateSearch(route.options.validateSearch, {
                  ...validatedSearch,
                  ...nextSearch,
                }),
              )
            } catch {
              // ignore errors here because they are already handled in matchRoutes
            }
          }
        })
        nextSearch = validatedSearch
      }

      nextSearch = applySearchMiddleware({
        search: nextSearch,
        dest,
        destRoutes,
        _includeValidateSearch: opts._includeValidateSearch,
      })

      // Replace the equal deep
      nextSearch = nullReplaceEqualDeep(fromSearch, nextSearch)

      // Stringify the next search
      const searchStr = this.options.stringifySearch(nextSearch)

      // Resolve the next hash
      const hash =
        dest.hash === true
          ? currentLocation.hash
          : dest.hash
            ? functionalUpdate(dest.hash, currentLocation.hash)
            : undefined

      // Resolve the next hash string
      const hashStr = hash ? `#${hash}` : ''

      // Resolve the next state
      let nextState =
        dest.state === true
          ? currentLocation.state
          : dest.state
            ? functionalUpdate(dest.state, currentLocation.state)
            : {}

      // Replace the equal deep
      nextState = replaceEqualDeep(currentLocation.state, nextState)

      // Create the full path of the location
      const fullPath = `${nextPathname}${searchStr}${hashStr}`

      // Compute href and publicHref without URL construction when no rewrite
      let href: string
      let publicHref: string
      let external = false

      if (this.rewrite) {
        // With rewrite, we need to construct URL to apply the rewrite
        const url = new URL(fullPath, this.origin)
        const rewrittenUrl = executeRewriteOutput(this.rewrite, url)
        href = url.href.replace(url.origin, '')
        // If rewrite changed the origin, publicHref needs full URL
        // Otherwise just use the path components
        if (rewrittenUrl.origin !== this.origin) {
          publicHref = rewrittenUrl.href
          external = true
        } else {
          publicHref =
            rewrittenUrl.pathname + rewrittenUrl.search + rewrittenUrl.hash
        }
      } else {
        // Fast path: no rewrite, skip URL construction entirely
        // fullPath is already the correct href (origin-stripped)
        // We need to encode non-ASCII (unicode) characters for the href
        // since decodePath decoded them from the interpolated path
        href = encodePathLikeUrl(fullPath)
        publicHref = href
      }

      return {
        publicHref,
        href,
        pathname: nextPathname,
        search: nextSearch,
        searchStr,
        state: nextState as any,
        hash: hash ?? '',
        external,
        unmaskOnReload: dest.unmaskOnReload,
      }
    }

    const buildWithMatches = (
      dest: BuildNextOptions = {},
      maskedDest?: BuildNextOptions,
    ) => {
      const next = build(dest)

      let maskedNext = maskedDest ? build(maskedDest) : undefined

      if (!maskedNext) {
        const params = Object.create(null)

        if (this.options.routeMasks) {
          const match = findFlatMatch<RouteMask<TRouteTree>>(
            next.pathname,
            this.processedTree,
          )
          if (match) {
            Object.assign(params, match.rawParams) // Copy params, because they're cached
            const {
              from: _from,
              params: maskParams,
              ...maskProps
            } = match.route

            // If mask has a params function, call it with the matched params as context
            // Otherwise, use the matched params or the provided params value
            const nextParams =
              maskParams === false || maskParams === null
                ? Object.create(null)
                : (maskParams ?? true) === true
                  ? params
                  : Object.assign(params, functionalUpdate(maskParams, params))

            maskedDest = {
              from: opts.from,
              ...maskProps,
              params: nextParams,
            }
            maskedNext = build(maskedDest)
          }
        }
      }

      if (maskedNext) {
        next.maskedLocation = maskedNext
      }

      return next
    }

    if (opts.mask) {
      return buildWithMatches(opts, {
        from: opts.from,
        ...opts.mask,
      })
    }

    return buildWithMatches(opts)
  }

  commitLocationPromise: undefined | ControlledPromise<void>

  /**
   * Commit a previously built location to history (push/replace), optionally
   * using view transitions and scroll restoration options.
   */
  commitLocation: CommitLocationFn = async ({
    viewTransition,
    ignoreBlocker,
    ...next
  }) => {
    let historyAction: HistoryAction | undefined
    const isSameState = () => {
      // the following props are ignored but may still be provided when navigating,
      // temporarily add the previous values to the next state so they don't affect
      // the comparison
      const ignoredProps = [
        'key', // TODO: Remove in v2 - use __TSR_key instead
        '__TSR_key',
        '__TSR_index',
        '__hashScrollIntoViewOptions',
      ] as const
      ignoredProps.forEach((prop) => {
        ;(next.state as any)[prop] = this.latestLocation.state[prop]
      })
      const isEqual = deepEqual(next.state, this.latestLocation.state)
      ignoredProps.forEach((prop) => {
        delete next.state[prop]
      })
      return isEqual
    }

    const isSameUrl =
      trimPathRight(this.latestLocation.href) === trimPathRight(next.href)

    let previousCommitPromise = this.commitLocationPromise
    this.commitLocationPromise = createControlledPromise<void>(() => {
      previousCommitPromise?.resolve()
      previousCommitPromise = undefined
    })

    // Don't commit to history if nothing changed
    if (isSameUrl && isSameState()) {
      this.load()
    } else {
      let {
        // eslint-disable-next-line prefer-const
        maskedLocation,
        // eslint-disable-next-line prefer-const
        hashScrollIntoView,
        ...nextHistory
      } = next

      if (maskedLocation) {
        nextHistory = {
          ...maskedLocation,
          state: {
            ...maskedLocation.state,
            __tempKey: undefined,
            __tempLocation: {
              ...nextHistory,
              search: nextHistory.searchStr,
              state: {
                ...nextHistory.state,
                __tempKey: undefined!,
                __tempLocation: undefined!,
                __TSR_key: undefined!,
                key: undefined!, // TODO: Remove in v2 - use __TSR_key instead
              },
            },
          },
        }

        if (
          nextHistory.unmaskOnReload ??
          this.options.unmaskOnReload ??
          false
        ) {
          nextHistory.state.__tempKey = this.tempLocationKey
        }
      }

      nextHistory.state.__hashScrollIntoViewOptions =
        hashScrollIntoView ?? this.options.defaultHashScrollIntoView ?? true

      this.shouldViewTransition = viewTransition

      historyAction = next.replace ? 'REPLACE' : 'PUSH'

      this.history[historyAction === 'REPLACE' ? 'replace' : 'push'](
        nextHistory.publicHref,
        nextHistory.state,
        { ignoreBlocker },
      )
    }

    this._scroll.next = next.resetScroll ?? true

    if (!this.history.subscribers.size) {
      this.load(
        historyAction
          ? {
              action: { type: historyAction },
            }
          : undefined,
      )
    }

    return this.commitLocationPromise
  }

  /** Convenience helper: build a location from options, then commit it. */
  buildAndCommitLocation = ({
    replace,
    resetScroll,
    hashScrollIntoView,
    viewTransition,
    ignoreBlocker,
    href,
    ...rest
  }: BuildNextOptions & CommitLocationOptions = {}) => {
    if (href) {
      const currentIndex = this.history.location.state.__TSR_index

      const parsed = parseHref(href, {
        __TSR_index: replace ? currentIndex : currentIndex + 1,
      })

      // If the href contains the basepath, we need to strip it before setting `to`
      // because `buildLocation` will add the basepath back when creating the final URL.
      // Without this, hrefs like '/app/about' would become '/app/app/about'.
      const hrefUrl = new URL(parsed.pathname, this.origin)
      const rewrittenUrl = executeRewriteInput(this.rewrite, hrefUrl)

      rest.to = rewrittenUrl.pathname
      rest.search = this.options.parseSearch(parsed.search)
      // remove the leading `#` from the hash
      rest.hash = parsed.hash.slice(1)
    }

    const location = this.buildLocation({
      ...(rest as any),
      _includeValidateSearch: true,
    })

    this.pendingBuiltLocation = location as ParsedLocation<
      FullSearchSchema<TRouteTree>
    >

    const commitPromise = this.commitLocation({
      ...location,
      viewTransition,
      replace,
      resetScroll,
      hashScrollIntoView,
      ignoreBlocker,
    })

    // Clear pending location after commit starts
    // We do this on next microtask to allow synchronous navigate calls to chain
    queueMicrotask(() => {
      if (this.pendingBuiltLocation === location) {
        this.pendingBuiltLocation = undefined
      }
    })

    return commitPromise
  }

  /**
   * Imperatively navigate using standard `NavigateOptions`. When `reloadDocument`
   * or an absolute `href` is provided, performs a full document navigation.
   * Otherwise, builds and commits a client-side location.
   *
   * @link https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType
   */
  navigate: NavigateFn = async ({
    to,
    reloadDocument,
    href,
    publicHref,
    ...rest
  }) => {
    let hrefIsUrl = false

    if (href) {
      try {
        new URL(`${href}`)
        hrefIsUrl = true
      } catch {}
    }

    if (hrefIsUrl && !reloadDocument) {
      reloadDocument = true
    }

    if (reloadDocument) {
      // When to is provided, always build a location to get the proper publicHref
      // (this handles redirects where href might be an internal path from resolveRedirect)
      // When only href is provided (no to), use it directly as it should already
      // be a complete path (possibly with basepath)
      if (to !== undefined || !href) {
        const location = this.buildLocation({ to, ...rest } as any)
        // Use publicHref which contains the path (origin-stripped is fine for reload)
        href = href ?? location.publicHref
        publicHref = publicHref ?? location.publicHref
      }

      // Use publicHref when available and href is not a full URL,
      // otherwise use href directly (which may already include basepath)
      const reloadHref = !hrefIsUrl && publicHref ? publicHref : href

      // Block dangerous protocols like javascript:, blob:, data:
      // These could execute arbitrary code if passed to window.location
      if (isDangerousProtocol(reloadHref, this.protocolAllowlist)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `Blocked navigation to dangerous protocol: ${reloadHref}`,
          )
        }
        return
      }

      // Check blockers for external URLs unless ignoreBlocker is true
      if (!rest.ignoreBlocker) {
        // Cast to access internal getBlockers method
        const historyWithBlockers = this.history as any
        const blockers = historyWithBlockers.getBlockers?.() ?? []
        for (const blocker of blockers) {
          if (blocker?.blockerFn) {
            const shouldBlock = await blocker.blockerFn({
              currentLocation: this.latestLocation,
              nextLocation: this.latestLocation, // External URLs don't have a next location in our router
              action: 'PUSH',
            })
            if (shouldBlock) {
              return
            }
          }
        }
      }

      if (rest.replace) {
        window.location.replace(reloadHref)
      } else {
        window.location.href = reloadHref
      }
      return
    }

    return this.buildAndCommitLocation({
      ...rest,
      href,
      to: to as string,
      _isNavigate: true,
    })
  }

  latestLoadPromise: undefined | Promise<void>

  beforeLoad = () => {
    // Cancel any pending matches
    this.cancelMatches()
    this.updateLatestLocation()

    if (isServer ?? this.isServer) {
      // for SPAs on the initial load, this is handled by the Transitioner
      const nextLocation = this.buildLocation({
        to: this.latestLocation.pathname,
        search: true,
        params: true,
        hash: true,
        state: true,
        _includeValidateSearch: true,
      })

      // Check if location changed - origin check is unnecessary since buildLocation
      // always uses this.origin when constructing URLs
      if (this.latestLocation.publicHref !== nextLocation.publicHref) {
        const href = this.getParsedLocationHref(nextLocation)
        if (nextLocation.external) {
          throw redirect({ href })
        } else {
          throw redirect({ href, _builtLocation: nextLocation })
        }
      }
    }

    // Match the routes
    const pendingMatches = this.matchRoutes(this.latestLocation)

    const nextCachedMatches = this.stores.cachedMatches
      .get()
      .filter((d) => !pendingMatches.some((e) => e.id === d.id))

    // Ingest the new matches
    this.batch(() => {
      this.stores.status.set('pending')
      this.stores.statusCode.set(200)
      this.stores.isLoading.set(true)
      this.stores.location.set(this.latestLocation)
      this.stores.setPending(pendingMatches)
      // If a cached match moved to pending matches, remove it from cached matches
      this.stores.setCached(nextCachedMatches)
    })
  }

  load: LoadFn = async (opts): Promise<void> => {
    const historyAction = opts?.action?.type
    let redirect: AnyRedirect | undefined
    let notFound: NotFoundError | undefined
    let loadPromise: Promise<void>
    const previousLocation =
      this.stores.resolvedLocation.get() ?? this.stores.location.get()

    // eslint-disable-next-line prefer-const
    loadPromise = new Promise<void>((resolve) => {
      this.startTransition(async () => {
        try {
          this.beforeLoad()
          if (historyAction) {
            this._scroll.hash =
              historyAction === 'PUSH' || historyAction === 'REPLACE'
          }
          const next = this.latestLocation
          const prevLocation = this.stores.resolvedLocation.get()
          const locationChangeInfo = getLocationChangeInfo(next, prevLocation)

          if (!this.stores.redirect.get()) {
            this.emit({
              type: 'onBeforeNavigate',
              ...locationChangeInfo,
            })
          }

          this.emit({
            type: 'onBeforeLoad',
            ...locationChangeInfo,
          })

          await loadMatches({
            router: this,
            sync: opts?.sync,
            forceStaleReload: previousLocation.href === next.href,
            matches: this.stores.pendingMatches.get(),
            location: next,
            updateMatch: this.updateMatch,
            // eslint-disable-next-line @typescript-eslint/require-await
            onReady: async () => {
              // Wrap batch in framework-specific transition wrapper (e.g., Solid's startTransition)
              this.startTransition(() => {
                this.startViewTransition(async () => {
                  // this.viewTransitionPromise = createControlledPromise<true>()

                  // Commit the pending matches. If a previous match was
                  // removed, place it in the cachedMatches
                  //
                  // exitingMatches uses match.id (routeId + params + loaderDeps) so
                  // navigating /foo?page=1 → /foo?page=2 correctly caches the page=1 entry.
                  let exitingMatches: Array<AnyRouteMatch> | null = null

                  // Lifecycle-hook identity uses routeId only so that navigating between
                  // different params/deps of the same route fires onStay (not onLeave+onEnter).
                  let hookExitingMatches: Array<AnyRouteMatch> | null = null
                  let hookEnteringMatches: Array<AnyRouteMatch> | null = null
                  let hookStayingMatches: Array<AnyRouteMatch> | null = null

                  this.batch(() => {
                    const pendingMatches = this.stores.pendingMatches.get()
                    const mountPending = pendingMatches.length
                    const currentMatches = this.stores.matches.get()

                    exitingMatches = mountPending
                      ? currentMatches.filter(
                          (match) =>
                            !this.stores.pendingMatchStores.has(match.id),
                        )
                      : null

                    // Lifecycle-hook identity: routeId only (route presence in tree)
                    // Build routeId sets from pools to avoid derived stores.
                    const pendingRouteIds = new Set<string>()
                    for (const s of this.stores.pendingMatchStores.values()) {
                      if (s.routeId) pendingRouteIds.add(s.routeId)
                    }
                    const activeRouteIds = new Set<string>()
                    for (const s of this.stores.matchStores.values()) {
                      if (s.routeId) activeRouteIds.add(s.routeId)
                    }

                    hookExitingMatches = mountPending
                      ? currentMatches.filter(
                          (match) => !pendingRouteIds.has(match.routeId),
                        )
                      : null
                    hookEnteringMatches = mountPending
                      ? pendingMatches.filter(
                          (match) => !activeRouteIds.has(match.routeId),
                        )
                      : null
                    hookStayingMatches = mountPending
                      ? pendingMatches.filter((match) =>
                          activeRouteIds.has(match.routeId),
                        )
                      : currentMatches

                    this.stores.isLoading.set(false)
                    this.stores.loadedAt.set(Date.now())
                    /**
                     * When committing new matches, cache any exiting matches that are still usable.
                     * Routes that resolved with `status: 'error'` or `status: 'notFound'` are
                     * deliberately excluded from `cachedMatches` so that subsequent invalidations
                     * or reloads re-run their loaders instead of reusing the failed/not-found data.
                     */
                    if (mountPending) {
                      this.stores.setMatches(pendingMatches)
                      this.stores.setPending([])
                      this.stores.setCached([
                        ...this.stores.cachedMatches.get(),
                        ...exitingMatches!.filter(
                          (d) =>
                            d.status !== 'error' &&
                            d.status !== 'notFound' &&
                            d.status !== 'redirected',
                        ),
                      ])
                      this.clearExpiredCache()
                    }
                  })

                  //
                  for (const [matches, hook] of [
                    [hookExitingMatches, 'onLeave'],
                    [hookEnteringMatches, 'onEnter'],
                    [hookStayingMatches, 'onStay'],
                  ] as const) {
                    if (!matches) continue
                    for (const match of matches as Array<AnyRouteMatch>) {
                      this.looseRoutesById[match.routeId]!.options[hook]?.(
                        match,
                      )
                    }
                  }
                })
              })
            },
          })
        } catch (err) {
          if (isRedirect(err)) {
            redirect = err
            if (!(isServer ?? this.isServer)) {
              this.navigate({
                ...redirect.options,
                replace: true,
                ignoreBlocker: true,
              })
            }
          } else if (isNotFound(err)) {
            notFound = err
          }

          const nextStatusCode = redirect
            ? redirect.status
            : notFound
              ? 404
              : this.stores.matches.get().some((d) => d.status === 'error')
                ? 500
                : 200

          this.batch(() => {
            this.stores.statusCode.set(nextStatusCode)
            this.stores.redirect.set(redirect)
          })
        }

        if (this.latestLoadPromise === loadPromise) {
          this.commitLocationPromise?.resolve()
          this.latestLoadPromise = undefined
          this.commitLocationPromise = undefined
        }

        resolve()
      })
    })

    this.latestLoadPromise = loadPromise

    await loadPromise

    while (
      (this.latestLoadPromise as any) &&
      loadPromise !== this.latestLoadPromise
    ) {
      await this.latestLoadPromise
    }

    let newStatusCode: number | undefined = undefined
    if (this.hasNotFoundMatch()) {
      newStatusCode = 404
    } else if (this.stores.matches.get().some((d) => d.status === 'error')) {
      newStatusCode = 500
    }
    if (newStatusCode !== undefined) {
      this.stores.statusCode.set(newStatusCode)
    }
  }

  startViewTransition = (fn: () => Promise<void>) => {
    // Determine if we should start a view transition from the navigation
    // or from the router default
    const shouldViewTransition =
      this.shouldViewTransition ?? this.options.defaultViewTransition

    // Reset the view transition flag
    this.shouldViewTransition = undefined

    // Attempt to start a view transition (or just apply the changes if we can't)
    if (
      shouldViewTransition &&
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof document.startViewTransition === 'function'
    ) {
      // lib.dom.ts doesn't support viewTransition types variant yet.
      // TODO: Fix this when dom types are updated
      let startViewTransitionParams: any

      if (
        typeof shouldViewTransition === 'object' &&
        this.isViewTransitionTypesSupported
      ) {
        const next = this.latestLocation
        const prevLocation = this.stores.resolvedLocation.get()

        const resolvedViewTransitionTypes =
          typeof shouldViewTransition.types === 'function'
            ? shouldViewTransition.types(
                getLocationChangeInfo(next, prevLocation),
              )
            : shouldViewTransition.types

        if (resolvedViewTransitionTypes === false) {
          fn()
          return
        }

        startViewTransitionParams = {
          update: fn,
          types: resolvedViewTransitionTypes,
        }
      } else {
        startViewTransitionParams = fn
      }

      document.startViewTransition(startViewTransitionParams)
    } else {
      fn()
    }
  }

  updateMatch: UpdateMatchFn = (id, updater) => {
    this.startTransition(() => {
      const pendingMatch = this.stores.pendingMatchStores.get(id)
      if (pendingMatch) {
        pendingMatch.set(updater)
        return
      }

      const activeMatch = this.stores.matchStores.get(id)
      if (activeMatch) {
        activeMatch.set(updater)
        return
      }

      const cachedMatch = this.stores.cachedMatchStores.get(id)
      if (cachedMatch) {
        const next = updater(cachedMatch.get())
        if (next.status === 'redirected') {
          const deleted = this.stores.cachedMatchStores.delete(id)
          if (deleted) {
            this.stores.cachedIds.set((prev) =>
              prev.filter((matchId) => matchId !== id),
            )
          }
        } else {
          cachedMatch.set(next)
        }
      }
    })
  }

  getMatch: GetMatchFn = (matchId: string): AnyRouteMatch | undefined => {
    return (
      this.stores.cachedMatchStores.get(matchId)?.get() ??
      this.stores.pendingMatchStores.get(matchId)?.get() ??
      this.stores.matchStores.get(matchId)?.get()
    )
  }

  /**
   * Invalidate the current matches and optionally force them back into a pending state.
   *
   * - Marks all matches that pass the optional `filter` as `invalid: true`.
   * - If `forcePending` is true, or a match is currently in `'error'` or `'notFound'` status,
   *   its status is reset to `'pending'` and its `error` cleared so that the loader is re-run
   *   on the next `load()` call (eg. after HMR or a manual invalidation).
   */
  invalidate: InvalidateFn<
    RouterCore<
      TRouteTree,
      TTrailingSlashOption,
      TDefaultStructuralSharingOption,
      TRouterHistory,
      TDehydrated
    >
  > = (opts) => {
    const invalidate = (d: MakeRouteMatch<TRouteTree>) => {
      if (opts?.filter?.(d as MakeRouteMatchUnion<this>) ?? true) {
        return {
          ...d,
          invalid: true,
          ...(opts?.forcePending ||
          d.status === 'error' ||
          d.status === 'notFound'
            ? ({ status: 'pending', error: undefined } as const)
            : undefined),
        }
      }
      return d
    }

    this.batch(() => {
      this.stores.setMatches(this.stores.matches.get().map(invalidate))
      this.stores.setCached(this.stores.cachedMatches.get().map(invalidate))
      this.stores.setPending(this.stores.pendingMatches.get().map(invalidate))
    })

    this.shouldViewTransition = false
    return this.load({ sync: opts?.sync })
  }

  getParsedLocationHref = (location: ParsedLocation) => {
    // For redirects and external use, we need publicHref (with rewrite output applied)
    // href is the internal path after rewrite input, publicHref is user-facing
    return location.publicHref || '/'
  }

  resolveRedirect = (redirect: AnyRedirect): AnyRedirect => {
    const locationHeader = redirect.headers.get('Location')

    if (!redirect.options.href || redirect.options._builtLocation) {
      const location =
        redirect.options._builtLocation ?? this.buildLocation(redirect.options)
      const href = this.getParsedLocationHref(location)
      redirect.options.href = href
      redirect.headers.set('Location', href)
    } else if (locationHeader) {
      try {
        const url = new URL(locationHeader)
        if (this.origin && url.origin === this.origin) {
          const href = url.pathname + url.search + url.hash
          redirect.options.href = href
          redirect.headers.set('Location', href)
        }
      } catch {
        // ignore invalid URLs
      }
    }

    if (
      redirect.options.href &&
      !redirect.options._builtLocation &&
      // Check for dangerous protocols before processing the redirect
      isDangerousProtocol(redirect.options.href, this.protocolAllowlist)
    ) {
      throw new Error(
        process.env.NODE_ENV !== 'production'
          ? `Redirect blocked: unsafe protocol in href "${redirect.options.href}". Allowed protocols: ${Array.from(this.protocolAllowlist).join(', ')}.`
          : 'Redirect blocked: unsafe protocol',
      )
    }

    if (!redirect.headers.get('Location')) {
      redirect.headers.set('Location', redirect.options.href)
    }

    return redirect
  }

  clearCache: ClearCacheFn<this> = (opts) => {
    const filter = opts?.filter
    if (filter !== undefined) {
      this.stores.setCached(
        this.stores.cachedMatches
          .get()
          .filter((m) => !filter(m as MakeRouteMatchUnion<this>)),
      )
    } else {
      this.stores.setCached([])
    }
  }

  clearExpiredCache = () => {
    const now = Date.now()
    // This is where all of the garbage collection magic happens
    const filter = (d: MakeRouteMatch<TRouteTree>) => {
      const route = this.looseRoutesById[d.routeId]!

      if (!route.options.loader) {
        return true
      }

      // If the route was preloaded, use the preloadGcTime
      // otherwise, use the gcTime
      const gcTime =
        (d.preload
          ? (route.options.preloadGcTime ?? this.options.defaultPreloadGcTime)
          : (route.options.gcTime ?? this.options.defaultGcTime)) ??
        5 * 60 * 1000

      const isError = d.status === 'error'
      if (isError) return true

      const gcEligible = now - d.updatedAt >= gcTime
      return gcEligible
    }
    this.clearCache({ filter })
  }

  loadRouteChunk = loadRouteChunk

  preloadRoute: PreloadRouteFn<
    TRouteTree,
    TTrailingSlashOption,
    TDefaultStructuralSharingOption,
    TRouterHistory
  > = async (opts) => {
    const next = opts._builtLocation ?? this.buildLocation(opts as any)

    let matches = this.matchRoutes(next, {
      throwOnError: true,
      preload: true,
      dest: opts,
    })

    const activeMatchIds = new Set([
      ...this.stores.matchesId.get(),
      ...this.stores.pendingIds.get(),
    ])

    const loadedMatchIds = new Set([
      ...activeMatchIds,
      ...this.stores.cachedIds.get(),
    ])

    // If the matches are already loaded, we need to add them to the cached matches.
    const matchesToCache = matches.filter(
      (match) => !loadedMatchIds.has(match.id),
    )
    if (matchesToCache.length) {
      const cachedMatches = this.stores.cachedMatches.get()
      this.stores.setCached([...cachedMatches, ...matchesToCache])
    }

    try {
      matches = await loadMatches({
        router: this,
        matches,
        location: next,
        preload: true,
        updateMatch: (id, updater) => {
          // Don't update the match if it's currently loaded
          if (activeMatchIds.has(id)) {
            matches = matches.map((d) => (d.id === id ? updater(d) : d))
          } else {
            this.updateMatch(id, updater)
          }
        },
      })

      return matches
    } catch (err) {
      if (isRedirect(err)) {
        if (err.options.reloadDocument) {
          return undefined
        }

        return await this.preloadRoute({
          ...err.options,
          _fromLocation: next,
        })
      }
      if (!isNotFound(err)) {
        // Preload errors are not fatal, but we should still log them
        console.error(err)
      }
      return undefined
    }
  }

  matchRoute: MatchRouteFn<
    TRouteTree,
    TTrailingSlashOption,
    TDefaultStructuralSharingOption,
    TRouterHistory
  > = (location, opts) => {
    const matchLocation = {
      ...location,
      to: location.to
        ? this.resolvePathWithBase(location.from || '', location.to as string)
        : undefined,
      params: location.params || {},
      leaveParams: true,
    }
    const next = this.buildLocation(matchLocation as any)

    if (opts?.pending && this.stores.status.get() !== 'pending') {
      return false
    }

    const pending =
      opts?.pending === undefined ? !this.stores.isLoading.get() : opts.pending

    const baseLocation = pending
      ? this.latestLocation
      : this.stores.resolvedLocation.get() || this.stores.location.get()

    const match = findSingleMatch(
      next.pathname,
      opts?.caseSensitive ?? false,
      opts?.fuzzy ?? false,
      baseLocation.pathname,
      this.processedTree,
    )

    if (!match) {
      return false
    }

    if (location.params) {
      if (!deepEqual(match.rawParams, location.params, { partial: true })) {
        return false
      }
    }

    if (opts?.includeSearch ?? true) {
      return deepEqual(baseLocation.search, next.search, { partial: true })
        ? match.rawParams
        : false
    }

    return match.rawParams
  }

  ssr?: {
    manifest: Manifest | undefined
  }

  serverSsr?: ServerSsr

  serverSsrLifecycle?: RouterSsrLifecycle

  hasNotFoundMatch = () => {
    return this.stores.matches
      .get()
      .some((d) => d.status === 'notFound' || d.globalNotFound)
  }
}

/** Error thrown when search parameter validation fails. */
export class SearchParamError extends Error {}

/** Error thrown when path parameter parsing/validation fails. */
export class PathParamError extends Error {}

const normalize = (str: string) =>
  str.endsWith('/') && str.length > 1 ? str.slice(0, -1) : str
function comparePaths(a: string, b: string) {
  return normalize(a) === normalize(b)
}

/**
 * Lazily import a module function and forward arguments to it, retaining
 * parameter and return types for the selected export key.
 */
export function lazyFn<
  T extends Record<string, (...args: Array<any>) => any>,
  TKey extends keyof T = 'default',
>(fn: () => Promise<T>, key?: TKey) {
  return async (
    ...args: Parameters<T[TKey]>
  ): Promise<Awaited<ReturnType<T[TKey]>>> => {
    const imported = await fn()
    return imported[key || 'default'](...args)
  }
}

/** Create an initial RouterState from a parsed location. */
export function getInitialRouterState(
  location: ParsedLocation,
): RouterState<any> {
  return {
    loadedAt: 0,
    isLoading: false,
    isTransitioning: false,
    status: 'idle',
    resolvedLocation: undefined,
    location,
    matches: [],
    statusCode: 200,
  }
}

function validateSearch(validateSearch: AnyValidator, input: unknown): unknown {
  if (validateSearch == null) return {}

  if ('~standard' in validateSearch) {
    const result = validateSearch['~standard'].validate(input)

    if (result instanceof Promise)
      throw new SearchParamError('Async validation not supported')

    if (result.issues)
      throw new SearchParamError(JSON.stringify(result.issues, undefined, 2), {
        cause: result,
      })

    return result.value
  }

  if ('parse' in validateSearch) {
    return validateSearch.parse(input)
  }

  if (typeof validateSearch === 'function') {
    return validateSearch(input)
  }

  return {}
}

/**
 * Build the matched route chain and extract params for a pathname.
 * Falls back to the root route if no specific route is found.
 */
export function getMatchedRoutes<TRouteLike extends RouteLike>({
  pathname,
  routesById,
  processedTree,
}: {
  pathname: string
  routesById: Record<string, TRouteLike>
  processedTree: ProcessedTree<any, any, any>
}) {
  const routeParams: Record<string, string> = Object.create(null)
  const trimmedPath = trimPathRight(pathname)

  let foundRoute: TRouteLike | undefined = undefined
  const match = findRouteMatch<TRouteLike>(trimmedPath, processedTree, true)
  if (match) {
    foundRoute = match.route
    Object.assign(routeParams, match.rawParams) // Copy params, because they're cached
  }

  const matchedRoutes = match?.branch || [routesById[rootRouteId]!]

  return { matchedRoutes, routeParams, foundRoute }
}

/**
 * TODO: once caches are persisted across requests on the server,
 * we can cache the built middleware chain using `last(destRoutes)` as the key
 */
function applySearchMiddleware({
  search,
  dest,
  destRoutes,
  _includeValidateSearch,
}: {
  search: any
  dest: { search?: unknown }
  destRoutes: ReadonlyArray<AnyRoute>
  _includeValidateSearch: boolean | undefined
}) {
  const middleware = buildMiddlewareChain(destRoutes)
  return middleware(search, dest, _includeValidateSearch ?? false)
}

function buildMiddlewareChain(destRoutes: ReadonlyArray<AnyRoute>) {
  let dest: BuildNextOptions
  let includeValidateSearch: boolean | undefined
  const middlewares = [] as Array<SearchMiddleware<any>>

  for (const route of destRoutes) {
    const routeOptions = route.options
    if ('search' in routeOptions) {
      if (routeOptions.search?.middlewares) {
        middlewares.push(...routeOptions.search.middlewares)
      }
    }
    // TODO remove preSearchFilters and postSearchFilters in v2
    else if (routeOptions.preSearchFilters || routeOptions.postSearchFilters) {
      const legacyMiddleware: SearchMiddleware<any> = ({ search, next }) => {
        const nextSearch = routeOptions.preSearchFilters
          ? routeOptions.preSearchFilters.reduce(
              (prev, next) => next(prev),
              search,
            )
          : search

        const result = next(nextSearch)

        return routeOptions.postSearchFilters
          ? routeOptions.postSearchFilters.reduce(
              (prev, next) => next(prev),
              result,
            )
          : result
      }
      middlewares.push(legacyMiddleware)
    }

    const routeValidateSearch = routeOptions.validateSearch
    if (routeValidateSearch) {
      const validate: SearchMiddleware<any> = ({ search, next, meta }) => {
        const result = next(search)
        if (includeValidateSearch) {
          try {
            const validated = validateSearch(routeValidateSearch, result) as any

            if (meta && validated) {
              for (const key in validated) {
                if (!(key in result)) {
                  ;(meta.defaulted ||= new Map()).set(key, validated[key])
                }
              }
            }
            return { ...result, ...validated }
          } catch {
            // ignore errors here because they are already handled in matchRoutes
          }
        }
        return result
      }

      middlewares.push(validate)
    }
  }

  const applyNext = (
    index: number,
    currentSearch: any,
    meta?: SearchMiddlewareMeta,
  ): any => {
    // no more middlewares left, return the current search
    if (index >= middlewares.length) {
      if (!dest.search) {
        return {}
      }
      if (dest.search === true) {
        return currentSearch
      }
      const result = functionalUpdate(dest.search, currentSearch)
      if (meta) {
        meta.explicit = result
      }
      return result
    }

    const next = (newSearch: any, collectMeta?: true): any => {
      if (collectMeta) {
        const nextMeta = meta || ({} as SearchMiddlewareMeta)
        return {
          search: applyNext(index + 1, newSearch, nextMeta),
          meta: nextMeta,
        }
      }
      return applyNext(index + 1, newSearch, meta)
    }

    return (middlewares[index]! as any)({ search: currentSearch, next, meta })
  }

  return function middleware(
    search: any,
    nextDest: BuildNextOptions,
    _includeValidateSearch: boolean,
  ) {
    dest = nextDest
    includeValidateSearch = _includeValidateSearch
    return applyNext(0, search)
  }
}

function findGlobalNotFoundRouteId(
  notFoundMode: 'root' | 'fuzzy' | undefined,
  routes: ReadonlyArray<AnyRoute>,
) {
  if (notFoundMode !== 'root') {
    for (let i = routes.length - 1; i >= 0; i--) {
      const route = routes[i]!
      if (route.children) {
        return route.id
      }
    }
  }
  return rootRouteId
}

function extractStrictParams(
  route: AnyRoute,
  accumulatedParams: Record<string, unknown>,
) {
  const parseParams = route.options.params?.parse ?? route.options.parseParams
  if (parseParams) {
    const result = parseParams(accumulatedParams as Record<string, string>)
    if (result === false) {
      throw new Error('Route params.parse returned false for a matched route')
    }
    Object.assign(accumulatedParams, result)
  }
}
