import * as Vue from 'vue'
import {
  deepEqual,
  exactPathTest,
  hasKeys,
  isDangerousProtocol,
  preloadWarning,
  removeTrailingSlash,
} from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'

import { useStore } from '@tanstack/vue-store'
import { useRouter } from './useRouter'
import { useIntersectionObserver } from './utils'

import type {
  AnyRouter,
  Constrain,
  LinkOptions,
  ParsedLocation,
  RegisteredRouter,
  RoutePaths,
} from '@tanstack/router-core'
import type { AnchorHTMLAttributes, ReservedProps } from '@vue/runtime-dom'
import type {
  ValidateLinkOptions,
  ValidateLinkOptionsArray,
} from './typePrimitives'

type EventHandler<TEvent = Event> = (e: TEvent) => void

const timeoutMap = new WeakMap<EventTarget, ReturnType<typeof setTimeout>>()

type DataAttributes = {
  [K in `data-${string}`]?: unknown
}

type LinkHTMLAttributes = AnchorHTMLAttributes &
  ReservedProps &
  DataAttributes & {
    // Vue's runtime-dom types use lowercase event names.
    // Also accept camelCase versions for external API compatibility.
    onMouseEnter?: EventHandler<MouseEvent>
    onMouseLeave?: EventHandler<MouseEvent>
    onMouseOver?: EventHandler<MouseEvent>
    onMouseOut?: EventHandler<MouseEvent>
    onTouchStart?: EventHandler<TouchEvent>

    // `disabled` is not a valid <a> attribute, but is useful when using `asChild`.
    disabled?: boolean
  }

type VueStyleLinkEventHandlers = {
  onMouseenter?: EventHandler<MouseEvent>
  onMouseleave?: EventHandler<MouseEvent>
  onMouseover?: EventHandler<MouseEvent>
  onMouseout?: EventHandler<MouseEvent>
  onTouchstart?: EventHandler<TouchEvent>
}

interface StyledProps {
  class?: LinkHTMLAttributes['class']
  style?: LinkHTMLAttributes['style']
  [key: string]: unknown
}

type PropsOfComponent<TComp> =
  // Functional components
  TComp extends (props: infer P, ...args: Array<unknown>) => any
    ? P
    : // Vue components (defineComponent, class components, etc)
      TComp extends Vue.Component<infer P>
      ? P
      : Record<string, unknown>

type AnyLinkPropsOptions = UseLinkPropsOptions<any, any, any, any, any>
type LinkEventOptions = AnyLinkPropsOptions & Partial<VueStyleLinkEventHandlers>

export function useLinkProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string = '',
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '',
>(
  options: UseLinkPropsOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
): LinkHTMLAttributes {
  const router = useRouter()
  const isTransitioning = Vue.ref(false)
  let hasRenderFetched = false

  // Ensure router is defined before proceeding
  if (!router) {
    console.warn('useRouter must be used inside a <RouterProvider> component!')
    return Vue.computed(() => ({})) as unknown as LinkHTMLAttributes
  }

  // Determine if the link is external or internal
  const type = Vue.computed(() => {
    try {
      new URL(`${options.to}`)
      return 'external'
    } catch {
      return 'internal'
    }
  })

  const ref = Vue.ref<Element | null>(null)
  const eventHandlers = getLinkEventHandlers(options as LinkEventOptions)

  if (type.value === 'external') {
    // Block dangerous protocols like javascript:, blob:, data:
    if (isDangerousProtocol(options.to as string, router.protocolAllowlist)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Blocked Link with dangerous protocol: ${options.to}`)
      }
      // Return props without href to prevent navigation
      const safeProps: Record<string, unknown> = {
        ...getPropsSafeToSpread(options as AnyLinkPropsOptions),
        ref,
        // No href attribute - blocks the dangerous protocol
        target: options.target,
        disabled: options.disabled,
        style: options.style,
        class: options.class,
        onClick: options.onClick,
        onBlur: options.onBlur,
        onFocus: options.onFocus,
        onMouseenter: eventHandlers.onMouseenter,
        onMouseleave: eventHandlers.onMouseleave,
        onMouseover: eventHandlers.onMouseover,
        onMouseout: eventHandlers.onMouseout,
        onTouchstart: eventHandlers.onTouchstart,
      }

      // Remove undefined values
      Object.keys(safeProps).forEach((key) => {
        if (safeProps[key] === undefined) {
          delete safeProps[key]
        }
      })

      return Vue.computed(
        () => safeProps as LinkHTMLAttributes,
      ) as unknown as LinkHTMLAttributes
    }

    // External links just have simple props
    const externalProps: Record<string, unknown> = {
      ...getPropsSafeToSpread(options as AnyLinkPropsOptions),
      ref,
      href: options.to,
      target: options.target,
      disabled: options.disabled,
      style: options.style,
      class: options.class,
      onClick: options.onClick,
      onBlur: options.onBlur,
      onFocus: options.onFocus,
      onMouseenter: eventHandlers.onMouseenter,
      onMouseleave: eventHandlers.onMouseleave,
      onMouseover: eventHandlers.onMouseover,
      onMouseout: eventHandlers.onMouseout,
      onTouchstart: eventHandlers.onTouchstart,
    }

    // Remove undefined values
    Object.keys(externalProps).forEach((key) => {
      if (externalProps[key] === undefined) {
        delete externalProps[key]
      }
    })

    return Vue.computed(
      () => externalProps as LinkHTMLAttributes,
    ) as unknown as LinkHTMLAttributes
  }

  // During SSR we render exactly once and do not need reactivity.
  // Avoid store subscriptions, effects and observers on the server.
  if (isServer ?? router.isServer) {
    const next = router.buildLocation(options as any)
    const href = getHref({
      options: options as AnyLinkPropsOptions,
      router,
      nextLocation: next,
    })

    const isActive = getIsActive({
      loc: router.stores.location.get(),
      nextLoc: next,
      activeOptions: options.activeOptions,
      router,
    })

    const {
      resolvedActiveProps,
      resolvedInactiveProps,
      resolvedClassName,
      resolvedStyle,
    } = resolveStyleProps({
      options: options as AnyLinkPropsOptions,
      isActive,
    })

    const result = combineResultProps({
      href,
      options: options as AnyLinkPropsOptions,
      isActive,
      isTransitioning: false,
      resolvedActiveProps,
      resolvedInactiveProps,
      resolvedClassName,
      resolvedStyle,
    })

    return Vue.ref(
      result as LinkHTMLAttributes,
    ) as unknown as LinkHTMLAttributes
  }

  const currentLocation = useStore(router.stores.location, (l) => l, {
    equal: (prev, next) => prev.href === next.href,
  })

  const next = Vue.computed(() => {
    // Rebuild when inherited search/hash or the current route context changes.

    const opts = { _fromLocation: currentLocation.value, ...options }
    return router.buildLocation(opts)
  })

  const preload = Vue.computed(() => {
    if (options.reloadDocument) {
      return false
    }
    return options.preload ?? router.options.defaultPreload
  })

  const preloadDelay = Vue.computed(
    () => options.preloadDelay ?? router.options.defaultPreloadDelay ?? 0,
  )

  const isActive = Vue.computed(() =>
    getIsActive({
      activeOptions: options.activeOptions,
      loc: currentLocation.value,
      nextLoc: next.value,
      router,
    }),
  )

  const doPreload = () =>
    router
      .preloadRoute({ ...options, _builtLocation: next.value } as any)
      .catch((err: any) => {
        console.warn(err)
        console.warn(preloadWarning)
      })

  const preloadViewportIoCallback = (
    entry: IntersectionObserverEntry | undefined,
  ) => {
    if (entry?.isIntersecting) {
      doPreload()
    }
  }

  useIntersectionObserver(
    ref,
    preloadViewportIoCallback,
    { rootMargin: '100px' },
    { disabled: () => !!options.disabled || !(preload.value === 'viewport') },
  )

  Vue.effect(() => {
    if (hasRenderFetched) {
      return
    }
    if (!options.disabled && preload.value === 'render') {
      doPreload()
      hasRenderFetched = true
    }
  })

  // The click handler
  const handleClick = (e: PointerEvent): void => {
    // Check actual element's target attribute as fallback
    const elementTarget = (
      e.currentTarget as HTMLAnchorElement | SVGAElement
    )?.getAttribute('target')
    const effectiveTarget =
      options.target !== undefined ? options.target : elementTarget

    if (
      !options.disabled &&
      !isCtrlEvent(e) &&
      !e.defaultPrevented &&
      (!effectiveTarget || effectiveTarget === '_self') &&
      e.button === 0
    ) {
      // Don't prevent default or handle navigation if reloadDocument is true
      if (options.reloadDocument) {
        return
      }

      e.preventDefault()

      isTransitioning.value = true

      const unsub = router.subscribe('onResolved', () => {
        unsub()
        isTransitioning.value = false
      })

      // All is well? Navigate!
      router.navigate({
        ...options,
        replace: options.replace,
        resetScroll: options.resetScroll,
        hashScrollIntoView: options.hashScrollIntoView,
        startTransition: options.startTransition,
        viewTransition: options.viewTransition,
        ignoreBlocker: options.ignoreBlocker,
      })
    }
  }

  const enqueueIntentPreload = (e: MouseEvent | FocusEvent) => {
    if (options.disabled || preload.value !== 'intent') return

    if (!preloadDelay.value) {
      doPreload()
      return
    }

    const eventTarget = e.currentTarget || e.target

    if (!eventTarget || timeoutMap.has(eventTarget)) return

    timeoutMap.set(
      eventTarget,
      setTimeout(() => {
        timeoutMap.delete(eventTarget)
        doPreload()
      }, preloadDelay.value),
    )
  }

  const handleTouchStart = (_: TouchEvent) => {
    if (options.disabled || preload.value !== 'intent') return
    doPreload()
  }

  const handleLeave = (e: MouseEvent | FocusEvent) => {
    if (options.disabled) return
    const eventTarget = e.currentTarget || e.target

    if (eventTarget) {
      const id = timeoutMap.get(eventTarget)
      clearTimeout(id)
      timeoutMap.delete(eventTarget)
    }
  }

  // Helper to compose event handlers - with explicit return type and better type handling
  function composeEventHandlers<T extends Event>(
    handlers: Array<EventHandler<T> | undefined>,
  ): (e: T) => void {
    return (event: T) => {
      for (const handler of handlers) {
        if (handler) {
          handler(event)
        }
      }
    }
  }

  // Get the active and inactive props
  const resolvedStyleProps = Vue.computed(() =>
    resolveStyleProps({
      options: options as AnyLinkPropsOptions,
      isActive: isActive.value,
    }),
  )

  const href = Vue.computed(() =>
    getHref({
      options: options as AnyLinkPropsOptions,
      router,
      nextLocation: next.value,
    }),
  )

  // Create static event handlers that don't change between renders
  const staticEventHandlers = {
    onClick: composeEventHandlers<PointerEvent>([options.onClick, handleClick]),
    onBlur: composeEventHandlers<FocusEvent>([options.onBlur, handleLeave]),
    onFocus: composeEventHandlers<FocusEvent>([
      options.onFocus,
      enqueueIntentPreload,
    ]),
    onMouseenter: composeEventHandlers<MouseEvent>([
      eventHandlers.onMouseenter,
      enqueueIntentPreload,
    ]),
    onMouseover: composeEventHandlers<MouseEvent>([
      eventHandlers.onMouseover,
      enqueueIntentPreload,
    ]),
    onMouseleave: composeEventHandlers<MouseEvent>([
      eventHandlers.onMouseleave,
      handleLeave,
    ]),
    onMouseout: composeEventHandlers<MouseEvent>([
      eventHandlers.onMouseout,
      handleLeave,
    ]),
    onTouchstart: composeEventHandlers<TouchEvent>([
      eventHandlers.onTouchstart,
      handleTouchStart,
    ]),
  }

  // Compute all props synchronously to avoid hydration mismatches
  // Using Vue.computed ensures props are calculated at render time, not after
  const computedProps = Vue.computed<LinkHTMLAttributes>(() => {
    const {
      resolvedActiveProps,
      resolvedInactiveProps,
      resolvedClassName,
      resolvedStyle,
    } = resolvedStyleProps.value
    return combineResultProps({
      href: href.value,
      options: options as AnyLinkPropsOptions,
      ref,
      staticEventHandlers,
      isActive: isActive.value,
      isTransitioning: isTransitioning.value,
      resolvedActiveProps,
      resolvedInactiveProps,
      resolvedClassName,
      resolvedStyle,
    })
  })

  // Return the computed ref itself - callers should access .value
  return computedProps as unknown as LinkHTMLAttributes
}

function resolveStyleProps({
  options,
  isActive,
}: {
  options: AnyLinkPropsOptions
  isActive: boolean
}) {
  const activeProps = options.activeProps || (() => ({ class: 'active' }))
  const resolvedActiveProps: StyledProps = (isActive
    ? typeof activeProps === 'function'
      ? activeProps()
      : activeProps
    : {}) || { class: undefined, style: undefined }

  const inactiveProps = options.inactiveProps || (() => ({}))

  const resolvedInactiveProps: StyledProps = (isActive
    ? {}
    : typeof inactiveProps === 'function'
      ? inactiveProps()
      : inactiveProps) || { class: undefined, style: undefined }

  const classes = [
    options.class,
    resolvedActiveProps?.class,
    resolvedInactiveProps?.class,
  ].filter(Boolean)
  const resolvedClassName = classes.length ? classes.join(' ') : undefined

  const result: Record<string, string | number> = {}

  // Merge styles from all sources
  if (options.style) {
    Object.assign(result, options.style)
  }

  if (resolvedActiveProps?.style) {
    Object.assign(result, resolvedActiveProps.style)
  }

  if (resolvedInactiveProps?.style) {
    Object.assign(result, resolvedInactiveProps.style)
  }

  const resolvedStyle = hasKeys(result) ? result : undefined
  return {
    resolvedActiveProps,
    resolvedInactiveProps,
    resolvedClassName,
    resolvedStyle,
  }
}

function combineResultProps({
  href,
  options,
  isActive,
  isTransitioning,
  resolvedActiveProps,
  resolvedInactiveProps,
  resolvedClassName,
  resolvedStyle,
  ref,
  staticEventHandlers,
}: {
  initial?: LinkHTMLAttributes
  href: string | undefined
  options: AnyLinkPropsOptions
  isActive: boolean
  isTransitioning: boolean
  resolvedActiveProps: StyledProps
  resolvedInactiveProps: StyledProps
  resolvedClassName?: string
  resolvedStyle?: Record<string, string | number>
  ref?: Vue.VNodeRef | undefined
  staticEventHandlers?: {
    onClick: any
    onBlur: any
    onFocus: any
    onMouseenter: any
    onMouseover: any
    onMouseleave: any
    onMouseout: any
    onTouchstart: any
  }
}) {
  const result: Record<string, unknown> = {
    ...getPropsSafeToSpread(options),
    ref,
    ...staticEventHandlers,
    href,
    disabled: !!options.disabled,
    target: options.target,
  }

  if (resolvedStyle) {
    result.style = resolvedStyle
  }

  if (resolvedClassName) {
    result.class = resolvedClassName
  }

  if (options.disabled) {
    result.role = 'link'
    result['aria-disabled'] = true
  }

  if (isActive) {
    result['data-status'] = 'active'
    result['aria-current'] = 'page'
  }

  if (isTransitioning) {
    result['data-transitioning'] = 'transitioning'
  }

  for (const key of Object.keys(resolvedActiveProps)) {
    if (key !== 'class' && key !== 'style') {
      result[key] = resolvedActiveProps[key]
    }
  }

  for (const key of Object.keys(resolvedInactiveProps)) {
    if (key !== 'class' && key !== 'style') {
      result[key] = resolvedInactiveProps[key]
    }
  }
  return result
}

function getLinkEventHandlers(
  options: LinkEventOptions,
): VueStyleLinkEventHandlers {
  return {
    onMouseenter: options.onMouseEnter ?? options.onMouseenter,
    onMouseleave: options.onMouseLeave ?? options.onMouseleave,
    onMouseover: options.onMouseOver ?? options.onMouseover,
    onMouseout: options.onMouseOut ?? options.onMouseout,
    onTouchstart: options.onTouchStart ?? options.onTouchstart,
  }
}

const getPropsSafeToSpread = (options: AnyLinkPropsOptions) => {
  const {
    activeProps: _activeProps,
    inactiveProps: _inactiveProps,
    activeOptions: _activeOptions,
    to: _to,
    preload: _preload,
    preloadDelay: _preloadDelay,
    preloadIntentProximity: _preloadIntentProximity,
    hashScrollIntoView: _hashScrollIntoView,
    replace: _replace,
    startTransition: _startTransition,
    resetScroll: _resetScroll,
    viewTransition: _viewTransition,
    children: _children,
    target: _target,
    disabled: _disabled,
    style: _style,
    class: _class,
    onClick: _onClick,
    onBlur: _onBlur,
    onFocus: _onFocus,
    onMouseEnter: _onMouseEnter,
    onMouseenter: _onMouseenter,
    onMouseLeave: _onMouseLeave,
    onMouseleave: _onMouseleave,
    onMouseOver: _onMouseOver,
    onMouseover: _onMouseover,
    onMouseOut: _onMouseOut,
    onMouseout: _onMouseout,
    onTouchStart: _onTouchStart,
    onTouchstart: _onTouchstart,
    ignoreBlocker: _ignoreBlocker,
    params: _params,
    search: _search,
    hash: _hash,
    state: _state,
    mask: _mask,
    reloadDocument: _reloadDocument,
    unsafeRelative: _unsafeRelative,
    _asChild: __asChild,
    from: _from,
    additionalProps: _additionalProps,
    ...propsSafeToSpread
  } = options as AnyLinkPropsOptions & {
    additionalProps?: unknown
    children?: unknown
    _asChild?: unknown
  }

  return propsSafeToSpread
}

function getIsActive({
  activeOptions,
  loc,
  nextLoc,
  router,
}: {
  activeOptions: LinkOptions['activeOptions']
  loc: {
    pathname: string
    search: any
    hash: string
  }
  nextLoc: {
    pathname: string
    search: any
    hash: string
  }
  router: AnyRouter
}) {
  if (activeOptions?.exact) {
    const testExact = exactPathTest(
      loc.pathname,
      nextLoc.pathname,
      router.basepath,
    )
    if (!testExact) {
      return false
    }
  } else {
    const currentPath = removeTrailingSlash(loc.pathname, router.basepath)
    const nextPath = removeTrailingSlash(nextLoc.pathname, router.basepath)

    const pathIsFuzzyEqual =
      currentPath.startsWith(nextPath) &&
      (currentPath.length === nextPath.length ||
        currentPath[nextPath.length] === '/')
    if (!pathIsFuzzyEqual) {
      return false
    }
  }

  if (activeOptions?.includeSearch ?? true) {
    const searchTest = deepEqual(loc.search, nextLoc.search, {
      partial: !activeOptions?.exact,
      ignoreUndefined: !activeOptions?.explicitUndefined,
    })
    if (!searchTest) {
      return false
    }
  }

  if (activeOptions?.includeHash) {
    return loc.hash === nextLoc.hash
  }
  return true
}

function getHref({
  options,
  router,
  nextLocation,
}: {
  options: AnyLinkPropsOptions
  router: AnyRouter
  nextLocation?: ParsedLocation
}) {
  if (options.disabled) {
    return undefined
  }
  const location = nextLocation?.maskedLocation ?? nextLocation

  // Use publicHref - it contains the correct href for display
  // When a rewrite changes the origin, publicHref is the full URL
  // Otherwise it's the origin-stripped path
  // This avoids constructing URL objects in the hot path
  const publicHref = location?.publicHref
  if (!publicHref) return undefined

  const external = location?.external
  if (external) return publicHref

  return router.history.createHref(publicHref) || '/'
}

// Type definitions
export type UseLinkPropsOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '.',
> = ActiveLinkOptions<'a', TRouter, TFrom, TTo, TMaskFrom, TMaskTo> &
  LinkHTMLAttributes

export type ActiveLinkOptions<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = LinkOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> &
  ActiveLinkOptionProps<TComp>

type ActiveLinkProps<TComp> = Partial<
  (TComp extends keyof HTMLElementTagNameMap
    ? LinkHTMLAttributes
    : PropsOfComponent<TComp>) & {
    [key: `data-${string}`]: unknown
  }
>

export interface ActiveLinkOptionProps<TComp = 'a'> {
  /**
   * A function that returns additional props for the `active` state of this link.
   * These props override other props passed to the link (`style`'s are merged, `class`'s are concatenated)
   */
  activeProps?: ActiveLinkProps<TComp> | (() => ActiveLinkProps<TComp>)
  /**
   * A function that returns additional props for the `inactive` state of this link.
   * These props override other props passed to the link (`style`'s are merged, `class`'s are concatenated)
   */
  inactiveProps?: ActiveLinkProps<TComp> | (() => ActiveLinkProps<TComp>)
}

export type LinkProps<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = ActiveLinkOptions<TComp, TRouter, TFrom, TTo, TMaskFrom, TMaskTo> &
  LinkPropsChildren

export interface LinkPropsChildren {
  // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
  children?:
    | Vue.VNodeChild
    | ((state: {
        isActive: boolean
        isTransitioning: boolean
      }) => Vue.VNodeChild)
}

type LinkComponentVueProps<TComp> = TComp extends keyof HTMLElementTagNameMap
  ? Omit<LinkHTMLAttributes, keyof CreateLinkProps>
  : Omit<PropsOfComponent<TComp>, keyof CreateLinkProps>

export type LinkComponentProps<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = LinkComponentVueProps<TComp> &
  LinkProps<TComp, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>

export type CreateLinkProps = LinkProps<
  any,
  any,
  string,
  string,
  string,
  string
>

export type LinkComponent<
  in out TComp,
  in out TDefaultFrom extends string = string,
> = <
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = TDefaultFrom,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = '',
>(
  props: LinkComponentProps<TComp, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
) => Vue.VNode

export interface LinkComponentRoute<
  in out TDefaultFrom extends string = string,
> {
  defaultFrom: TDefaultFrom;
  <
    TRouter extends AnyRouter = RegisteredRouter,
    const TTo extends string | undefined = undefined,
    const TMaskTo extends string = '',
  >(
    props: LinkComponentProps<
      'a',
      TRouter,
      this['defaultFrom'],
      TTo,
      this['defaultFrom'],
      TMaskTo
    >,
  ): Vue.VNode
}

export function createLink<const TComp>(
  Comp: Constrain<TComp, any, (props: CreateLinkProps) => Vue.VNode>,
): LinkComponent<TComp> {
  return Vue.defineComponent({
    name: 'CreatedLink',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => Vue.h(LinkImpl, { ...attrs, _asChild: Comp }, slots)
    },
  }) as any
}

const LinkImpl = Vue.defineComponent({
  name: 'Link',
  inheritAttrs: false,
  props: [
    '_asChild',
    'to',
    'preload',
    'preloadDelay',
    'preloadIntentProximity',
    'activeProps',
    'inactiveProps',
    'activeOptions',
    'from',
    'search',
    'params',
    'hash',
    'state',
    'mask',
    'reloadDocument',
    'disabled',
    'additionalProps',
    'viewTransition',
    'resetScroll',
    'startTransition',
    'hashScrollIntoView',
    'replace',
    'ignoreBlocker',
    'target',
  ],
  setup(props, { attrs, slots }) {
    // Call useLinkProps ONCE during setup with combined props and attrs
    const allProps = { ...props, ...attrs }
    const linkPropsSource = useLinkProps(allProps) as
      | LinkHTMLAttributes
      | Vue.ComputedRef<LinkHTMLAttributes>

    return () => {
      const Component = props._asChild || 'a'

      const linkProps = Vue.unref(linkPropsSource)

      const isActive = linkProps['data-status'] === 'active'
      const isTransitioning =
        linkProps['data-transitioning'] === 'transitioning'

      // Create the slot content or empty array if no default slot
      const slotContent = slots.default
        ? slots.default({
            isActive,
            isTransitioning,
          })
        : []

      // Special handling for SVG links - wrap an <a> inside the SVG
      if (Component === 'svg') {
        // Create props without class for svg link
        const svgLinkProps = { ...linkProps }
        delete svgLinkProps.class
        return Vue.h('svg', {}, [Vue.h('a', svgLinkProps, slotContent)])
      }

      // For custom functional components (non-string), pass children as a prop
      // since they may expect children as a prop like in Solid
      if (typeof Component !== 'string') {
        return Vue.h(
          Component,
          { ...linkProps, children: slotContent },
          slotContent,
        )
      }

      // Return the component with props and children
      return Vue.h(Component, linkProps, slotContent)
    }
  },
})

/**
 * Link component with proper TypeScript generics support
 */
export const Link = LinkImpl as unknown as Vue.Component<unknown> &
  Vue.Component<CreateLinkProps> &
  LinkComponent<'a'>

function isCtrlEvent(e: MouseEvent) {
  return !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
}

export type LinkOptionsFnOptions<
  TOptions,
  TComp,
  TRouter extends AnyRouter = RegisteredRouter,
> =
  TOptions extends ReadonlyArray<any>
    ? ValidateLinkOptionsArray<TRouter, TOptions, string, TComp>
    : ValidateLinkOptions<TRouter, TOptions, string, TComp>

export type LinkOptionsFn<TComp> = <
  const TOptions,
  TRouter extends AnyRouter = RegisteredRouter,
>(
  options: LinkOptionsFnOptions<TOptions, TComp, TRouter>,
) => TOptions

export const linkOptions: LinkOptionsFn<'a'> = (options) => {
  return options as any
}
