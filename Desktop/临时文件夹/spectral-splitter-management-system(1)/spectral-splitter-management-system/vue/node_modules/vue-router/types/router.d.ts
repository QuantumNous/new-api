import Vue, {
  PluginFunction,
  AsyncComponent,
  VNode,
  Component as _Component
} from 'vue'

type Component =
  | {}
  | _Component<any, any, any, any>
  | AsyncComponent<any, any, any, any>

type Dictionary<T> = { [key: string]: T }
type ErrorHandler = (err: Error) => void

export type RouterMode = 'hash' | 'history' | 'abstract'
export type RawLocation = string | Location
export type RedirectOption = RawLocation | ((to: Route) => RawLocation)
export type NavigationGuardNext<V extends Vue = Vue> = (
  to?: RawLocation | false | ((vm: V) => any) | void
) => void

export type NavigationGuard<V extends Vue = Vue> = (
  to: Route,
  from: Route,
  next: NavigationGuardNext<V>
) => any

/**
 * Router instance.
 */
export declare class VueRouter {
  constructor(options?: RouterOptions)

  app: Vue
  /**
   * Original options object passed to create the Router
   */
  options: RouterOptions
  /**
   * Configured mode when creating the Router instance.
   */
  mode: RouterMode
  /**
   * Current {@link Route}
   */
  currentRoute: Route

  /**
   * Add a navigation guard that executes before any navigation.
   *
   * @param guard - navigation guard to add
   * @returns a function that removes the registered guard
   *
   * @example
   * ```js
   * router.beforeEach((to, from, next) => {
   *   // must call `next`
   * })
   * ```
   */
  beforeEach(guard: NavigationGuard): () => void
  /**
   * Add a navigation guard that executes before navigation is about to be resolved. At this state all component have
   * been fetched and other navigation guards have been successful.
   *
   * @param guard - navigation guard to add
   * @returns a function that removes the registered guard
   *
   * @example
   * ```js
   * router.beforeResolve((to, from, next) => {
   *   // must call `next`
   * })
   * ```
   */
  beforeResolve(guard: NavigationGuard): () => void
  /**
   * Add a navigation hook that is executed after every navigation. Returns a function that removes the registered hook.
   *
   * @param hook - navigation hook to add
   * @returns a function that removes the registered guard
   *
   * @example
   * ```js
   * router.afterEach((to, from) => {
   *   console.log('after navigation')
   * })
   * ```
   */
  afterEach(hook: (to: Route, from: Route) => any): () => void
  /**
   * Programmatically navigate to a new URL by pushing an entry in the history stack.
   *
   * @param to Route location to navigate to
   */
  push(to: RawLocation): Promise<Route>
  /**
   * Programmatically navigate to a new URL by pushing an entry in the history stack.
   *
   * @param to Route location to navigate to
   * @param onComplete Navigation success callback
   * @param onAbort Navigation aborted callback
   */
  push(
    to: RawLocation,
    onComplete?: (route: Route) => void,
    onAbort?: ErrorHandler
  ): void
  /**
   * Programmatically navigate to a new URL by replacing the current entry in the history stack.
   *
   * @param to Route location to navigate to
   */
  replace(to: RawLocation): Promise<Route>
  /**
   * Programmatically navigate to a new URL by replacing the current entry in the history stack.
   *
   * @param to Route location to navigate to
   * @param onComplete Navigation success callback
   * @param onAbort Navigation aborted callback
   */
  replace(
    to: RawLocation,
    onComplete?: (route: Route) => void,
    onAbort?: ErrorHandler
  ): void
  /**
   * Allows you to move forward or backward through the history. Calls `history.go()`.
   *
   * @param delta The position in the history to which you want to move, relative to the current page
   */
  go(n: number): void
  /**
   * Go back in history if possible by calling `history.back()`. Equivalent to `router.go(-1)`.
   */
  back(): void
  /**
   * Go forward in history if possible by calling `history.forward()`. Equivalent to `router.go(1)`.
   */
  forward(): void
  match (raw: RawLocation, current?: Route, redirectedFrom?: Location): Route
  getMatchedComponents(to?: RawLocation | Route): Component[]
  /**
   * This method queues a callback to be called when the router has completed the initial navigation, which means it has
   * resolved all async enter hooks and async components that are associated with the initial route.
   *
   * This is useful in server-side rendering to ensure consistent output on both the server and the client.
   * @param cb onReady callback.
   * @param errorCb errorCb will be called when the initial route resolution runs into an error (e.g. failed to resolve
   * an async component).
   */
  onReady(cb: () => void, errorCb?: ErrorHandler): void
  /**
   * Adds an error handler that is called every time a non caught error happens during navigation. This includes errors
   * thrown synchronously and asynchronously, errors returned or passed to `next` in any navigation guard, and errors
   * occurred when trying to resolve an async component that is required to render a route.
   *
   * @param handler - error handler to register
   */
  onError(cb: ErrorHandler): void
  /**
   * @deprecated use {@link addRoute | router.addRoute()} instead
   */
  addRoutes(routes: RouteConfig[]): void
  /**
   * Add a new {@link RouteConfig | route record} as the child of an existing route. If the route has a `name` and there
   * is already an existing one with the same one, it overwrites it.
   *
   * @param parentName - Parent Route Record where `route` should be appended at
   * @param route - Route Record to add
   */
  addRoute(parentName: string, route: RouteConfig): void
  /**
   * Add a new {@link RouteConfig | route} to the router. If the route has a `name` and there is already an existing one
   * with the same one, it overwrites it.
   * @param route - Route Record to add
   */
  addRoute(route: RouteConfig): void
  /**
   * Get the list of all the active route records.
   */
  getRoutes(): RouteRecordPublic[]

  /**
   *
   * @param to Route location
   * @param current current is the current Route by default (most of the time you don't need to change this)
   * @param append allows you to append the path to the `current` route (as with `router-link`)
   */
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location
    route: Route
    href: string
    /**
     * backwards compat
     */
    normalizedTo: Location
    /**
     * backwards compat
     */
    resolved: Route
  }
  /**
   * @internal
   */
  static install: PluginFunction<never>
  static version: string

  static isNavigationFailure: typeof isNavigationFailure
  static NavigationFailureType: {
    [k in keyof typeof NavigationFailureType]: NavigationFailureType
  }

  static START_LOCATION: Route
}

/**
 * Enumeration with all possible types for navigation failures.
 *
 * Can be passed to {@link isNavigationFailure} to check for specific failures.
 */
export enum NavigationFailureType {
  /**
   * @internal
   */
  redirected = 2,
  /**
   * An aborted navigation is a navigation that failed because a navigation guard returned `false` or called
   * `next(false)`
   */
  aborted = 4,
  /**
   * A cancelled navigation is a navigation that failed because a more recent navigation finished started (not
   * necessarily finished).
   */
  cancelled = 8,
  /**
   * A duplicated navigation is a navigation that failed because it was initiated while already being at the exact same
   * location.
   */
  duplicated = 16
}

/**
 * Extended Error that contains extra information regarding a failed navigation.
 */
export interface NavigationFailure extends Error {
  /**
   * Route location we were navigating from
   */
  from: Route
  /**
   * Route location we were navigating to
   */
  to: Route
  /**
   * Type of the navigation. One of {@link NavigationFailureType}
   */
  type: NavigationFailureType.aborted | NavigationFailureType.cancelled | NavigationFailureType.duplicated
}

/**
 * Check if an object is a {@link NavigationFailure}.
 */
export declare function isNavigationFailure(error: any, type?: NavigationFailureType): error is NavigationFailure

type Position = { x: number; y: number }
type PositionResult = Position | { selector: string; offset?: Position, behavior?: ScrollBehavior } | void


/**
 * Options to initialize a {@link VueRouter} instance.
 */
export interface RouterOptions {
  routes?: RouteConfig[]
  /**
   * Configure the router mode.
   *
   * default: `"hash"` (in browser) | `"abstract"` (in Node.js)
   *
   * available values: `"hash" | "history" | "abstract"`
   * - `"hash"`: uses the URL hash for routing. Works in all Vue-supported browsers, including those that do not support
   *   HTML5 History API.
   * - `"history"`: requires HTML5 History API and server config. See HTML5 History Mode.
   * - `"abstract"`: works in all JavaScript environments, e.g. server-side with Node.js. **The router will
   *   automatically be forced into this mode if no browser API is present.**
   */
  mode?: RouterMode
  fallback?: boolean
  base?: string
  /**
   * Default class applied to active {@link RouterLink}. If none is provided, `router-link-active` will be applied.
   */
  linkActiveClass?: string
  /**
   * Default class applied to active {@link RouterLink}. If none is provided, `router-link-exact-active` will be
   * applied.
   */
  linkExactActiveClass?: string
  /**
   * Custom implementation to parse a query. See its counterpart, {@link stringifyQuery}.
   */
  parseQuery?: (query: string) => Object
  /**
   * Custom implementation to stringify a query object. Should not prepend a leading `?`. {@link parseQuery} counterpart
   * to handle query parsing.
   */
  stringifyQuery?: (query: Object) => string
  /**
   * Function to control scrolling when navigating between pages. Can return a Promise to delay scrolling.
   *
   * For more details see {@link Scroll Behavior}.
   */
  scrollBehavior?: (
    to: Route,
    from: Route,
    savedPosition: Position | void
  ) => PositionResult | Promise<PositionResult> | undefined | null
}

type RoutePropsFunction = (route: Route) => Object

export interface PathToRegexpOptions {
  sensitive?: boolean
  strict?: boolean
  end?: boolean
}

interface _RouteConfigBase {
  path: string
  name?: string
  children?: RouteConfig[]
  redirect?: RedirectOption
  alias?: string | string[]
  meta?: RouteMeta
  beforeEnter?: NavigationGuard
  caseSensitive?: boolean
  pathToRegexpOptions?: PathToRegexpOptions
}

interface RouteConfigSingleView extends _RouteConfigBase {
  component?: Component
  props?: boolean | Object | RoutePropsFunction
}

interface RouteConfigMultipleViews extends _RouteConfigBase {
  components?: Dictionary<Component>
  props?: Dictionary<boolean | Object | RoutePropsFunction>
}

export type RouteConfig = RouteConfigSingleView | RouteConfigMultipleViews

export interface RouteRecord {
  path: string
  regex: RegExp
  components: Dictionary<Component>
  instances: Dictionary<Vue>
  name?: string
  parent?: RouteRecord
  redirect?: RedirectOption
  matchAs?: string
  meta: RouteMeta
  beforeEnter?: (
    route: Route,
    redirect: (location: RawLocation) => void,
    next: () => void
  ) => any
  props:
    | boolean
    | Object
    | RoutePropsFunction
    | Dictionary<boolean | Object | RoutePropsFunction>
}

export interface RouteRecordPublic {
  path: string
  components: Dictionary<Component>
  instances: Dictionary<Vue>
  name?: string
  redirect?: RedirectOption
  meta: any
  beforeEnter?: (
    route: Route,
    redirect: (location: RawLocation) => void,
    next: () => void
  ) => any
  props:
    | boolean
    | Object
    | RoutePropsFunction
    | Dictionary<boolean | Object | RoutePropsFunction>
}


export interface Location {
  name?: string
  path?: string
  hash?: string
  query?: Dictionary<string | (string | null)[] | null | undefined>
  params?: Dictionary<string>
  append?: boolean
  replace?: boolean
}

export interface Route {
  path: string
  name?: string | null
  hash: string
  query: Dictionary<string | (string | null)[]>
  params: Dictionary<string>
  fullPath: string
  matched: RouteRecord[]
  redirectedFrom?: string
  meta?: RouteMeta
}

export interface RouteMeta extends Record<string | number | symbol, any> {}

export interface RouterLinkProps {
  /**
   * Denotes the target route of the link. When clicked, the value of the `to` prop will be passed to
   * `router.push()` internally, so the value can be either a string or a location descriptor object.
   */
  to: string | Location
  /**
   * Setting `replace` prop will call `router.replace()` instead of `router.push()` when clicked, so the navigation will
   * not create a new history record.
   *
   * @default false
   */
  replace?: boolean
  /**
   * Setting `append` prop always appends the relative path to the current path. For example, assuming we are navigating
   * from `/a` to a relative link `b`, without `append` we will end up at `/b`, but with append we will end up at
   * `/a/b`.
   *
   * @default false
   */
  append?: boolean
  /**
   * Sometimes we want <RouterLink> to render as another tag, e.g <li>. Then we can use tag prop to specify which tag to
   * render to, and it will still listen to click events for navigation.
   *
   * @default "a"
   */
  tag?: string
  /**
   * Configure the active CSS class applied when the link is active. Note the default value can also be configured
   * globally via the `linkActiveClass` router constructor option.
   *
   * @default "router-link-active"
   */
  activeClass?: string
  /**
   * The default active class matching behavior is **inclusive match**. For example, `<RouterLink to="/a">` will get
   * this class applied as long as the current path starts with `/a/` or is `/a`.
   *
   * @default false
   */
  exact?: boolean
  /**
   * Allows matching only using the `path` section of the url, effectively ignoring the `query` and the `hash` sections.
   *
   * @default false
   */
  exactPath?: boolean
  /**
   * Configure the active CSS class applied when the link is active with exact path match. Note the default value can
   * also be configured globally via the `linkExactPathActiveClass` router constructor option.
   *
   * @default "router-link-exact-path-active"
   */
  exactPathActiveClass?: string

  /**
   * Specify the event(s) that can trigger the link navigation.
   *
   * @default 'click'
   */
  event?: string | ReadonlyArray<string>
  /**
   * Configure the active CSS class applied when the link is active with exact match. Note the default value can also be
   * configured globally via the `linkExactActiveClass` router constructor option.
   *
   * @default "router-link-exact-active"
   */
  exactActiveClass?: string
  /**
   * Configure the value of `aria-current` when the link is active with exact match. It must be one of the allowed
   * values for [aria-current](https://www.w3.org/TR/wai-aria-1.2/#aria-current) in the ARIA spec. In most cases, the
   * default of page should be the best fit.
   *
   * @default "page"
   */
  ariaCurrentValue?:
    | 'page'
    | 'step'
    | 'location'
    | 'date'
    | 'time'
    | 'true'
    | 'false'
}

export interface RouterLinkSlotArgument {
  /**
   * resolved url. This would be the `href` attribute of an `a` element
   */
  href: string
  /**
   * resolved normalized location
   */
  route: Route
  /**
   * function to trigger the navigation. It will automatically prevent events when necessary, the same way `RouterLink`
   * does
   */
  navigate: (e?: MouseEvent) => Promise<undefined | NavigationFailure>
  /**
   * `true` if the [active class](https://v3.router.vuejs.org/api/#active-class) should be applied. Allows to apply an
   * arbitrary class
   */
  isActive: boolean
  /**
   * `true` if the [exact active class](https://v3.router.vuejs.org/api/#exact-active-class) should be applied. Allows
   * to apply an arbitrary class
   */
  isExactActive: boolean
}

/**
 * Component to render a link that triggers a navigation on click.
 */
export declare const RouterLink: new () => {
  $props: RouterLinkProps
  $scopedSlots: {
    default?: ({
      href,
      route,
      navigate,
      isActive,
      isExactActive
    }: RouterLinkSlotArgument) => VNode[] | undefined
  }
}

export interface RouterViewProps {
  /**
   * When a {@link RouterView | `<RouterView />`} has a name, it will render the component with the corresponding name
   * in the matched route record's components option. See [Named
   * Views](https://v3.router.vuejs.org/guide/essentials/named-views.html) for an example.
   *
   * @default "default"
   */
  name?: string
}

/**
 * Component to display the current route the user is at.
 */
export declare const RouterView: new () => {
  $props: RouterViewProps
}

/**
 * Initial route location where the router is. Can be used in navigation guards to differentiate the initial navigation.
 */
export declare const START_LOCATION: Route
