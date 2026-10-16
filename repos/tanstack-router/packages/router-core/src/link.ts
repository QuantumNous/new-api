import type { HistoryState, ParsedHistoryState } from '@tanstack/history'
import type {
  AllParams,
  CatchAllPaths,
  CurrentPath,
  FullSearchSchema,
  FullSearchSchemaInput,
  ParentPath,
  RouteByPath,
  RouteByToPath,
  RoutePaths,
  RouteToPath,
  ToPath,
} from './routeInfo'
import type {
  AnyRouter,
  RegisteredRouter,
  ViewTransitionOptions,
} from './router'
import type {
  ConstrainLiteral,
  Expand,
  MakeDifferenceOptional,
  NoInfer,
  NonNullableUpdater,
  Updater,
} from './utils'
import type { ParsedLocation } from './location'

export type IsRequiredParams<TParams> =
  Record<never, never> extends TParams ? never : true

export interface ParsePathParamsResult<
  in out TRequired,
  in out TOptional,
  in out TRest,
> {
  required: TRequired
  optional: TOptional
  rest: TRest
}

export type AnyParsePathParamsResult = ParsePathParamsResult<
  string,
  string,
  string
>

export type ParsePathParamsBoundaryStart<T extends string> =
  T extends `${infer TLeft}{-${infer TRight}`
    ? ParsePathParamsResult<
        ParsePathParams<TLeft>['required'],
        | ParsePathParams<TLeft>['optional']
        | ParsePathParams<TRight>['required']
        | ParsePathParams<TRight>['optional'],
        ParsePathParams<TRight>['rest']
      >
    : T extends `${infer TLeft}{${infer TRight}`
      ? ParsePathParamsResult<
          | ParsePathParams<TLeft>['required']
          | ParsePathParams<TRight>['required'],
          | ParsePathParams<TLeft>['optional']
          | ParsePathParams<TRight>['optional'],
          ParsePathParams<TRight>['rest']
        >
      : never

export type ParsePathParamsSymbol<T extends string> =
  T extends `${string}$${infer TRight}`
    ? TRight extends `${string}/${string}`
      ? TRight extends `${infer TParam}/${infer TRest}`
        ? TParam extends ''
          ? ParsePathParamsResult<
              ParsePathParams<TRest>['required'],
              '_splat' | ParsePathParams<TRest>['optional'],
              ParsePathParams<TRest>['rest']
            >
          : ParsePathParamsResult<
              TParam | ParsePathParams<TRest>['required'],
              ParsePathParams<TRest>['optional'],
              ParsePathParams<TRest>['rest']
            >
        : never
      : TRight extends ''
        ? ParsePathParamsResult<never, '_splat', never>
        : ParsePathParamsResult<TRight, never, never>
    : never

export type ParsePathParamsBoundaryEnd<T extends string> =
  T extends `${infer TLeft}}${infer TRight}`
    ? ParsePathParamsResult<
        | ParsePathParams<TLeft>['required']
        | ParsePathParams<TRight>['required'],
        | ParsePathParams<TLeft>['optional']
        | ParsePathParams<TRight>['optional'],
        ParsePathParams<TRight>['rest']
      >
    : never

export type ParsePathParamsEscapeStart<T extends string> =
  T extends `${infer TLeft}[${infer TRight}`
    ? ParsePathParamsResult<
        | ParsePathParams<TLeft>['required']
        | ParsePathParams<TRight>['required'],
        | ParsePathParams<TLeft>['optional']
        | ParsePathParams<TRight>['optional'],
        ParsePathParams<TRight>['rest']
      >
    : never

export type ParsePathParamsEscapeEnd<T extends string> =
  T extends `${string}]${infer TRight}` ? ParsePathParams<TRight> : never

export type ParsePathParams<T extends string> = T extends `${string}[${string}`
  ? ParsePathParamsEscapeStart<T>
  : T extends `${string}]${string}`
    ? ParsePathParamsEscapeEnd<T>
    : T extends `${string}}${string}`
      ? ParsePathParamsBoundaryEnd<T>
      : T extends `${string}{${string}`
        ? ParsePathParamsBoundaryStart<T>
        : T extends `${string}$${string}`
          ? ParsePathParamsSymbol<T>
          : never

export type AddTrailingSlash<T> = T extends `${string}/` ? T : `${T & string}/`

export type RemoveTrailingSlashes<T> = T & `${string}/` extends never
  ? T
  : T extends `${infer R}/`
    ? R
    : T

export type AddLeadingSlash<T> = T & `/${string}` extends never
  ? `/${T & string}`
  : T

export type RemoveLeadingSlashes<T> = T & `/${string}` extends never
  ? T
  : T extends `/${infer R}`
    ? R
    : T

type JoinPath<TLeft extends string, TRight extends string> = TRight extends ''
  ? TLeft
  : TLeft extends ''
    ? TRight
    : `${RemoveTrailingSlashes<TLeft>}/${RemoveLeadingSlashes<TRight>}`

type RemoveLastSegment<
  T extends string,
  TAcc extends string = '',
> = T extends `${infer TSegment}/${infer TRest}`
  ? TRest & `${string}/${string}` extends never
    ? TRest extends ''
      ? TAcc
      : `${TAcc}${TSegment}`
    : RemoveLastSegment<TRest, `${TAcc}${TSegment}/`>
  : TAcc

export type ResolveCurrentPath<
  TFrom extends string,
  TTo extends string,
> = TTo extends '.'
  ? TFrom
  : TTo extends './'
    ? AddTrailingSlash<TFrom>
    : TTo & `./${string}` extends never
      ? never
      : TTo extends `./${infer TRest}`
        ? AddLeadingSlash<JoinPath<TFrom, TRest>>
        : never

export type ResolveParentPath<
  TFrom extends string,
  TTo extends string,
> = TTo extends '../' | '..'
  ? TFrom extends '' | '/'
    ? never
    : AddLeadingSlash<RemoveLastSegment<TFrom>>
  : TTo & `../${string}` extends never
    ? AddLeadingSlash<JoinPath<TFrom, TTo>>
    : TFrom extends '' | '/'
      ? never
      : TTo extends `../${infer ToRest}`
        ? ResolveParentPath<RemoveLastSegment<TFrom>, ToRest>
        : AddLeadingSlash<JoinPath<TFrom, TTo>>

export type ResolveRelativePath<TFrom, TTo = '.'> = string extends TFrom
  ? TTo
  : string extends TTo
    ? TFrom
    : undefined extends TTo
      ? TFrom
      : TTo extends string
        ? TFrom extends string
          ? TTo extends `/${string}`
            ? TTo
            : TTo extends `..${string}`
              ? ResolveParentPath<TFrom, TTo>
              : TTo extends `.${string}`
                ? ResolveCurrentPath<TFrom, TTo>
                : AddLeadingSlash<JoinPath<TFrom, TTo>>
          : never
        : never

export type FindDescendantToPaths<
  TRouter extends AnyRouter,
  TPrefix extends string,
> = `${TPrefix}/${string}` & RouteToPath<TRouter>

export type InferDescendantToPaths<
  TRouter extends AnyRouter,
  TPrefix extends string,
  TPaths = FindDescendantToPaths<TRouter, TPrefix>,
> = TPaths extends `${TPrefix}/`
  ? never
  : TPaths extends `${TPrefix}/${infer TRest}`
    ? TRest
    : never

export type RelativeToPath<
  TRouter extends AnyRouter,
  TTo extends string,
  TResolvedPath extends string,
> =
  | (TResolvedPath & RouteToPath<TRouter> extends never
      ? never
      : ToPath<TRouter, TTo>)
  | `${RemoveTrailingSlashes<TTo>}/${InferDescendantToPaths<TRouter, RemoveTrailingSlashes<TResolvedPath>>}`

export type RelativeToParentPath<
  TRouter extends AnyRouter,
  TFrom extends string,
  TTo extends string,
  TResolvedPath extends string = ResolveRelativePath<TFrom, TTo>,
> =
  | RelativeToPath<TRouter, TTo, TResolvedPath>
  | (TTo extends `${string}..` | `${string}../`
      ? TResolvedPath extends '/' | ''
        ? never
        : FindDescendantToPaths<
              TRouter,
              RemoveTrailingSlashes<TResolvedPath>
            > extends never
          ? never
          : `${RemoveTrailingSlashes<TTo>}/${ParentPath<TRouter>}`
      : never)

export type RelativeToCurrentPath<
  TRouter extends AnyRouter,
  TFrom extends string,
  TTo extends string,
  TResolvedPath extends string = ResolveRelativePath<TFrom, TTo>,
> = RelativeToPath<TRouter, TTo, TResolvedPath> | CurrentPath<TRouter>

export type AbsoluteToPath<TRouter extends AnyRouter, TFrom extends string> =
  | (string extends TFrom
      ? CurrentPath<TRouter>
      : TFrom extends `/`
        ? never
        : CurrentPath<TRouter>)
  | (string extends TFrom
      ? ParentPath<TRouter>
      : TFrom extends `/`
        ? never
        : ParentPath<TRouter>)
  | RouteToPath<TRouter>
  | (TFrom extends '/'
      ? never
      : string extends TFrom
        ? never
        : InferDescendantToPaths<TRouter, RemoveTrailingSlashes<TFrom>>)

export type RelativeToPathAutoComplete<
  TRouter extends AnyRouter,
  TFrom extends string,
  TTo extends string,
> = string extends TTo
  ? string
  : string extends TFrom
    ? AbsoluteToPath<TRouter, TFrom>
    : TTo & `..${string}` extends never
      ? TTo & `.${string}` extends never
        ? AbsoluteToPath<TRouter, TFrom>
        : RelativeToCurrentPath<TRouter, TFrom, TTo>
      : RelativeToParentPath<TRouter, TFrom, TTo>

export type NavigateOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = ToOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & NavigateOptionProps

/**
 * The NavigateOptions type is used to describe the options that can be used when describing a navigation action in TanStack Router.
 * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType)
 */
export interface NavigateOptionProps {
  /**
   * If set to `true`, the router will scroll the element with an id matching the hash into view with default `ScrollIntoViewOptions`.
   * If set to `false`, the router will not scroll the element with an id matching the hash into view.
   * If set to `ScrollIntoViewOptions`, the router will scroll the element with an id matching the hash into view with the provided options.
   * @default true
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#hashscrollintoview)
   * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
   */
  hashScrollIntoView?: boolean | ScrollIntoViewOptions
  /**
   * `replace` is a boolean that determines whether the navigation should replace the current history entry or push a new one.
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#replace)
   */
  replace?: boolean
  /**
   * Defaults to `true` so that the scroll position will be reset to 0,0 after the location is committed to the browser history.
   * If `false`, the scroll position will not be reset to 0,0 after the location is committed to history.
   * @default true
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#resetscroll)
   */
  resetScroll?: boolean
  /** @deprecated All navigations now use startTransition under the hood */
  startTransition?: boolean
  /**
   * If set to `true`, the router will wrap the resulting navigation in a `document.startViewTransition()` call.
   * If `ViewTransitionOptions`, route navigations will be called using `document.startViewTransition({update, types})`
   * where `types` will be the strings array passed with `ViewTransitionOptions["types"]`.
   * If the browser does not support viewTransition types, the navigation will fall back to normal `document.startTransition()`, same as if `true` was passed.
   *
   * If the browser does not support this api, this option will be ignored.
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#viewtransition)
   * @see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
   * @see [Google](https://developer.chrome.com/docs/web-platform/view-transitions/same-document#view-transition-types)
   */
  viewTransition?: boolean | ViewTransitionOptions
  /**
   * If `true`, navigation will ignore any blockers that might prevent it.
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#ignoreblocker)
   */
  ignoreBlocker?: boolean
  /**
   * If `true`, navigation to a route inside of router will trigger a full page load instead of the traditional SPA navigation.
   * @default false
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#reloaddocument)
   */
  reloadDocument?: boolean
  /**
   * This can be used instead of `to` to navigate to a fully built href, e.g. pointing to an external target.
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#href)
   */
  href?: string
  /** @internal */
  publicHref?: string
}

export type ToOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = ToSubOptions<TRouter, TFrom, TTo> & MaskOptions<TRouter, TMaskFrom, TMaskTo>

export interface MaskOptions<
  in out TRouter extends AnyRouter,
  in out TMaskFrom extends string,
  in out TMaskTo extends string,
> {
  _fromLocation?: ParsedLocation
  mask?: ToMaskOptions<TRouter, TMaskFrom, TMaskTo>
}

export type ToMaskOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TMaskFrom extends string = string,
  TMaskTo extends string = '.',
> = ToSubOptions<TRouter, TMaskFrom, TMaskTo> & {
  unmaskOnReload?: boolean
}

export type ToSubOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
> = ToSubOptionsProps<TRouter, TFrom, TTo> &
  SearchParamOptions<TRouter, TFrom, TTo> &
  PathParamOptions<TRouter, TFrom, TTo>

export interface RequiredToOptions<
  in out TRouter extends AnyRouter,
  in out TFrom extends string,
  in out TTo extends string | undefined,
> {
  /**
   * The internal route path to navigate to. This should be a relative or absolute path within your application.
   * For external URLs, use the `href` property instead.
   * @example "/dashboard" or "../profile"
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#href)
   */
  to: ToPathOption<TRouter, TFrom, TTo> & {}
}

export interface OptionalToOptions<
  in out TRouter extends AnyRouter,
  in out TFrom extends string,
  in out TTo extends string | undefined,
> {
  /**
   * The internal route path to navigate to. This should be a relative or absolute path within your application.
   * For external URLs, use the `href` property instead.
   * @example "/dashboard" or "../profile"
   * @link [API Docs](https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#href)
   */
  to?: ToPathOption<TRouter, TFrom, TTo> & {}
}

export type MakeToRequired<
  TRouter extends AnyRouter,
  TFrom extends string,
  TTo extends string | undefined,
> = string extends TFrom
  ? string extends TTo
    ? OptionalToOptions<TRouter, TFrom, TTo>
    : TTo & CatchAllPaths<TRouter> extends never
      ? RequiredToOptions<TRouter, TFrom, TTo>
      : OptionalToOptions<TRouter, TFrom, TTo>
  : OptionalToOptions<TRouter, TFrom, TTo>

export type ToSubOptionsProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string | undefined = '.',
> = MakeToRequired<TRouter, TFrom, TTo> & {
  hash?: true | Updater<string>
  state?: true | NonNullableUpdater<ParsedHistoryState, HistoryState>
  from?: FromPathOption<TRouter, TFrom> & {}
  unsafeRelative?: 'path'
}

export type ParamsReducerFn<
  in out TRouter extends AnyRouter,
  in out TParamVariant extends ParamVariant,
  in out TFrom,
  in out TTo,
> = (
  current: Expand<ResolveFromParams<TRouter, TParamVariant, TFrom>>,
) => Expand<ResolveRelativeToParams<TRouter, TParamVariant, TFrom, TTo>>

type ParamsReducer<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
  TFrom,
  TTo,
> =
  | Expand<ResolveRelativeToParams<TRouter, TParamVariant, TFrom, TTo>>
  | (ParamsReducerFn<TRouter, TParamVariant, TFrom, TTo> & {})

type ParamVariant = 'PATH' | 'SEARCH'

export type ResolveRoute<
  TRouter extends AnyRouter,
  TFrom,
  TTo,
  TPath = ResolveRelativePath<TFrom, TTo>,
> = TPath extends string
  ? TFrom extends TPath
    ? RouteByPath<TRouter['routeTree'], TPath>
    : RouteByToPath<TRouter, TPath>
  : never

type ResolveFromParamType<TParamVariant extends ParamVariant> =
  TParamVariant extends 'PATH' ? 'allParams' : 'fullSearchSchema'

type ResolveFromAllParams<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
> = TParamVariant extends 'PATH'
  ? AllParams<TRouter['routeTree']>
  : FullSearchSchema<TRouter['routeTree']>

type ResolveFromParams<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
  TFrom,
> = string extends TFrom
  ? ResolveFromAllParams<TRouter, TParamVariant>
  : RouteByPath<
      TRouter['routeTree'],
      TFrom
    >['types'][ResolveFromParamType<TParamVariant>]

type ResolveToParamType<TParamVariant extends ParamVariant> =
  TParamVariant extends 'PATH' ? 'allParams' : 'fullSearchSchemaInput'

type ResolveAllToParams<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
> = TParamVariant extends 'PATH'
  ? AllParams<TRouter['routeTree']>
  : FullSearchSchemaInput<TRouter['routeTree']>

export type ResolveToParams<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
  TFrom,
  TTo,
> =
  ResolveRelativePath<TFrom, TTo> extends infer TPath
    ? undefined extends TPath
      ? never
      : string extends TPath
        ? ResolveAllToParams<TRouter, TParamVariant>
        : TPath extends CatchAllPaths<TRouter>
          ? ResolveAllToParams<TRouter, TParamVariant>
          : ResolveRoute<
              TRouter,
              TFrom,
              TTo
            >['types'][ResolveToParamType<TParamVariant>]
    : never

type ResolveRelativeToParams<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
  TFrom,
  TTo,
  TToParams = ResolveToParams<TRouter, TParamVariant, TFrom, TTo>,
> = TParamVariant extends 'SEARCH'
  ? TToParams
  : string extends TFrom
    ? TToParams
    : MakeDifferenceOptional<
        ResolveFromParams<TRouter, TParamVariant, TFrom>,
        TToParams
      >

export interface MakeOptionalSearchParams<
  in out TRouter extends AnyRouter,
  in out TFrom,
  in out TTo,
> {
  search?: true | (ParamsReducer<TRouter, 'SEARCH', TFrom, TTo> & {})
}

export interface MakeOptionalPathParams<
  in out TRouter extends AnyRouter,
  in out TFrom,
  in out TTo,
> {
  params?: true | (ParamsReducer<TRouter, 'PATH', TFrom, TTo> & {})
}

type MakeRequiredParamsReducer<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
  TFrom,
  TTo,
> =
  | (string extends TFrom
      ? never
      : ResolveFromParams<
            TRouter,
            TParamVariant,
            TFrom
          > extends ResolveRelativeToParams<TRouter, TParamVariant, TFrom, TTo>
        ? true
        : never)
  | (ParamsReducer<TRouter, TParamVariant, TFrom, TTo> & {})

export interface MakeRequiredPathParams<
  in out TRouter extends AnyRouter,
  in out TFrom,
  in out TTo,
> {
  params: MakeRequiredParamsReducer<TRouter, 'PATH', TFrom, TTo> & {}
}

export interface MakeRequiredSearchParams<
  in out TRouter extends AnyRouter,
  in out TFrom,
  in out TTo,
> {
  search: MakeRequiredParamsReducer<TRouter, 'SEARCH', TFrom, TTo> & {}
}

export type IsRequired<
  TRouter extends AnyRouter,
  TParamVariant extends ParamVariant,
  TFrom,
  TTo,
> =
  ResolveRelativePath<TFrom, TTo> extends infer TPath
    ? undefined extends TPath
      ? never
      : TPath extends CatchAllPaths<TRouter>
        ? never
        : IsRequiredParams<
            ResolveRelativeToParams<TRouter, TParamVariant, TFrom, TTo>
          >
    : never

export type SearchParamOptions<TRouter extends AnyRouter, TFrom, TTo> =
  IsRequired<TRouter, 'SEARCH', TFrom, TTo> extends never
    ? MakeOptionalSearchParams<TRouter, TFrom, TTo>
    : MakeRequiredSearchParams<TRouter, TFrom, TTo>

export type PathParamOptions<TRouter extends AnyRouter, TFrom, TTo> =
  IsRequired<TRouter, 'PATH', TFrom, TTo> extends never
    ? MakeOptionalPathParams<TRouter, TFrom, TTo>
    : MakeRequiredPathParams<TRouter, TFrom, TTo>

export type ToPathOption<
  TRouter extends AnyRouter = AnyRouter,
  TFrom extends string = string,
  TTo extends string | undefined = string,
> = ConstrainLiteral<
  TTo,
  RelativeToPathAutoComplete<
    TRouter,
    NoInfer<TFrom> extends string ? NoInfer<TFrom> : '',
    NoInfer<TTo> & string
  >
>

export type FromPathOption<TRouter extends AnyRouter, TFrom> = ConstrainLiteral<
  TFrom,
  RoutePaths<TRouter['routeTree']>
>

/**
 * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/guide/navigation#active-options)
 */
export interface ActiveOptions {
  /**
   * If true, the link will be active if the current route matches the `to` route path exactly (no children routes)
   * @default false
   */
  exact?: boolean
  /**
   * If true, the link will only be active if the current URL hash matches the `hash` prop
   * @default false
   */
  includeHash?: boolean
  /**
   * If true, the link will only be active if the current URL search params inclusively match the `search` prop
   * @default true
   */
  includeSearch?: boolean
  /**
   * This modifies the `includeSearch` behavior.
   * If true,  properties in `search` that are explicitly `undefined` must NOT be present in the current URL search params for the link to be active.
   * @default false
   */
  explicitUndefined?: boolean
}

export interface LinkOptionsProps {
  /**
   * The standard anchor tag target attribute
   */
  target?: HTMLAnchorElement['target']
  /**
   * Configurable options to determine if the link should be considered active or not
   * @default {exact:true,includeHash:true}
   */
  activeOptions?: ActiveOptions
  /**
   * The preloading strategy for this link
   * - `false` - No preloading
   * - `'intent'` - Preload the linked route on hover and cache it for this many milliseconds in hopes that the user will eventually navigate there.
   * - `'viewport'` - Preload the linked route when it enters the viewport
   */
  preload?: false | 'intent' | 'viewport' | 'render'
  /**
   * When a preload strategy is set, this delays the preload by this many milliseconds.
   * If the user exits the link before this delay, the preload will be cancelled.
   */
  preloadDelay?: number
  /**
   * Control whether the link should be disabled or not
   * If set to `true`, the link will be rendered without an `href` attribute
   * @default false
   */
  disabled?: boolean
  /**
   * When the preload strategy is set to `intent`, this controls the proximity of the link to the cursor before it is preloaded.
   * If the user exits this proximity before this delay, the preload will be cancelled.
   */
  preloadIntentProximity?: number
}

export type LinkOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & LinkOptionsProps

export const preloadWarning = 'Error preloading route! ☝️'
