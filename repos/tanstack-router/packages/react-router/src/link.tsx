'use client'

import * as React from 'react'
import { useStore } from '@tanstack/react-store'
import { flushSync } from 'react-dom'
import {
  deepEqual,
  exactPathTest,
  functionalUpdate,
  hasKeys,
  isDangerousProtocol,
  preloadWarning,
  removeTrailingSlash,
} from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'

import { useForwardedRef, useIntersectionObserver } from './utils'

import { useHydrated } from './ClientOnly'
import type {
  AnyRouter,
  Constrain,
  LinkOptions,
  RegisteredRouter,
  RoutePaths,
} from '@tanstack/router-core'
import type { ReactNode } from 'react'
import type {
  ValidateLinkOptions,
  ValidateLinkOptionsArray,
} from './typePrimitives'

/**
 * Build anchor-like props for declarative navigation and preloading.
 *
 * Returns stable `href`, event handlers and accessibility props derived from
 * router options and active state. Used internally by `Link` and custom links.
 *
 * Options cover `to`, `params`, `search`, `hash`, `state`, `preload`,
 * `activeProps`, `inactiveProps`, and more.
 *
 * @returns React anchor props suitable for `<a>` or custom components.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useLinkPropsHook
 */
export function useLinkProps<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = '',
>(
  options: UseLinkPropsOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
  forwardedRef?: React.ForwardedRef<Element>,
): React.ComponentPropsWithRef<'a'> {
  const router = useRouter()
  const innerRef = useForwardedRef(forwardedRef)

  // Determine if we're on the server - used for tree-shaking client-only code
  const _isServer = isServer ?? router.isServer

  const {
    // custom props
    activeProps,
    inactiveProps,
    activeOptions,
    to,
    preload: userPreload,
    preloadDelay: userPreloadDelay,
    preloadIntentProximity: _preloadIntentProximity,
    hashScrollIntoView,
    replace,
    startTransition,
    resetScroll,
    viewTransition,
    // element props
    children,
    target,
    disabled,
    style,
    className,
    onClick,
    onBlur,
    onFocus,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    ignoreBlocker,
    // prevent these from being returned
    params: _params,
    search: _search,
    hash: _hash,
    state: _state,
    mask: _mask,
    reloadDocument: _reloadDocument,
    unsafeRelative: _unsafeRelative,
    from: _from,
    _fromLocation,
    ...propsSafeToSpread
  } = options

  // ==========================================================================
  // SERVER EARLY RETURN
  // On the server, we return static props without any event handlers,
  // effects, or client-side interactivity.
  //
  // For SSR parity (to avoid hydration errors), we still compute the link's
  // active status on the server, but we avoid creating any router-state
  // subscriptions by reading from the location store directly.
  //
  // Note: `location.hash` is not available on the server.
  // ==========================================================================
  if (_isServer) {
    const safeInternal = isSafeInternal(to)

    // If `to` is obviously an absolute URL, treat as external and avoid
    // computing the internal location via `buildLocation`.
    if (
      typeof to === 'string' &&
      !safeInternal &&
      // Quick checks to avoid `new URL` in common internal-like cases
      to.indexOf(':') > -1
    ) {
      try {
        new URL(to)
        if (isDangerousProtocol(to, router.protocolAllowlist)) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Blocked Link with dangerous protocol: ${to}`)
          }
          return {
            ...propsSafeToSpread,
            ref: innerRef as React.ComponentPropsWithRef<'a'>['ref'],
            href: undefined,
            ...(children && { children }),
            ...(target && { target }),
            ...(disabled && { disabled }),
            ...(style && { style }),
            ...(className && { className }),
          }
        }

        return {
          ...propsSafeToSpread,
          ref: innerRef as React.ComponentPropsWithRef<'a'>['ref'],
          href: to,
          ...(children && { children }),
          ...(target && { target }),
          ...(disabled && { disabled }),
          ...(style && { style }),
          ...(className && { className }),
        }
      } catch {
        // Not an absolute URL
      }
    }

    const next = router.buildLocation({ ...options, from: options.from } as any)

    // Use publicHref - it contains the correct href for display
    // When a rewrite changes the origin, publicHref is the full URL
    // Otherwise it's the origin-stripped path
    // This avoids constructing URL objects in the hot path
    const hrefOptionPublicHref = next.maskedLocation
      ? next.maskedLocation.publicHref
      : next.publicHref
    const hrefOptionExternal = next.maskedLocation
      ? next.maskedLocation.external
      : next.external
    const hrefOption = getHrefOption(
      hrefOptionPublicHref,
      hrefOptionExternal,
      router.history,
      disabled,
    )

    const externalLink = (() => {
      if (hrefOption?.external) {
        if (isDangerousProtocol(hrefOption.href, router.protocolAllowlist)) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `Blocked Link with dangerous protocol: ${hrefOption.href}`,
            )
          }
          return undefined
        }
        return hrefOption.href
      }

      if (safeInternal) return undefined

      // Only attempt URL parsing when it looks like an absolute URL.
      if (typeof to === 'string' && to.indexOf(':') > -1) {
        try {
          new URL(to)
          if (isDangerousProtocol(to, router.protocolAllowlist)) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(`Blocked Link with dangerous protocol: ${to}`)
            }
            return undefined
          }
          return to
        } catch {}
      }

      return undefined
    })()

    const isActive = (() => {
      if (externalLink) return false

      const currentLocation = router.stores.location.get()

      const exact = activeOptions?.exact ?? false

      if (exact) {
        const testExact = exactPathTest(
          currentLocation.pathname,
          next.pathname,
          router.basepath,
        )
        if (!testExact) {
          return false
        }
      } else {
        const currentPathSplit = removeTrailingSlash(
          currentLocation.pathname,
          router.basepath,
        )
        const nextPathSplit = removeTrailingSlash(
          next.pathname,
          router.basepath,
        )

        const pathIsFuzzyEqual =
          currentPathSplit.startsWith(nextPathSplit) &&
          (currentPathSplit.length === nextPathSplit.length ||
            currentPathSplit[nextPathSplit.length] === '/')

        if (!pathIsFuzzyEqual) {
          return false
        }
      }

      const includeSearch = activeOptions?.includeSearch ?? true
      if (includeSearch) {
        if (currentLocation.search !== next.search) {
          const currentSearchEmpty =
            !currentLocation.search ||
            (typeof currentLocation.search === 'object' &&
              !hasKeys(currentLocation.search))
          const nextSearchEmpty =
            !next.search ||
            (typeof next.search === 'object' &&
              !hasKeys(next.search as Record<string, unknown>))

          if (!(currentSearchEmpty && nextSearchEmpty)) {
            const searchTest = deepEqual(currentLocation.search, next.search, {
              partial: !exact,
              ignoreUndefined: !activeOptions?.explicitUndefined,
            })
            if (!searchTest) {
              return false
            }
          }
        }
      }

      // Hash is not available on the server
      if (activeOptions?.includeHash) {
        return false
      }

      return true
    })()

    if (externalLink) {
      return {
        ...propsSafeToSpread,
        ref: innerRef as React.ComponentPropsWithRef<'a'>['ref'],
        href: externalLink,
        ...(children && { children }),
        ...(target && { target }),
        ...(disabled && { disabled }),
        ...(style && { style }),
        ...(className && { className }),
      }
    }

    const resolvedActiveProps: React.HTMLAttributes<HTMLAnchorElement> =
      isActive
        ? (functionalUpdate(activeProps as any, {}) ?? STATIC_ACTIVE_OBJECT)
        : STATIC_EMPTY_OBJECT

    const resolvedInactiveProps: React.HTMLAttributes<HTMLAnchorElement> =
      isActive
        ? STATIC_EMPTY_OBJECT
        : (functionalUpdate(inactiveProps, {}) ?? STATIC_EMPTY_OBJECT)

    const resolvedStyle = (() => {
      const baseStyle = style
      const activeStyle = resolvedActiveProps.style
      const inactiveStyle = resolvedInactiveProps.style

      if (!baseStyle && !activeStyle && !inactiveStyle) {
        return undefined
      }

      if (baseStyle && !activeStyle && !inactiveStyle) {
        return baseStyle
      }

      if (!baseStyle && activeStyle && !inactiveStyle) {
        return activeStyle
      }

      if (!baseStyle && !activeStyle && inactiveStyle) {
        return inactiveStyle
      }

      return {
        ...baseStyle,
        ...activeStyle,
        ...inactiveStyle,
      }
    })()

    const resolvedClassName = (() => {
      const baseClassName = className
      const activeClassName = resolvedActiveProps.className
      const inactiveClassName = resolvedInactiveProps.className

      if (!baseClassName && !activeClassName && !inactiveClassName) {
        return ''
      }

      let out = ''

      if (baseClassName) {
        out = baseClassName
      }

      if (activeClassName) {
        out = out ? `${out} ${activeClassName}` : activeClassName
      }

      if (inactiveClassName) {
        out = out ? `${out} ${inactiveClassName}` : inactiveClassName
      }

      return out
    })()

    return {
      ...propsSafeToSpread,
      ...resolvedActiveProps,
      ...resolvedInactiveProps,
      href: hrefOption?.href,
      ref: innerRef as React.ComponentPropsWithRef<'a'>['ref'],
      disabled: !!disabled,
      target,
      ...(resolvedStyle && { style: resolvedStyle }),
      ...(resolvedClassName && { className: resolvedClassName }),
      ...(disabled && STATIC_DISABLED_PROPS),
      ...(isActive && STATIC_ACTIVE_PROPS),
    }
  }

  // ==========================================================================
  // CLIENT-ONLY CODE
  // Everything below this point only runs on the client. The `isServer` check
  // above is a compile-time constant that bundlers use for dead code elimination,
  // so this entire section is removed from server bundles.
  //
  // We disable the rules-of-hooks lint rule because these hooks appear after
  // an early return. This is safe because:
  // 1. `isServer` is a compile-time constant from conditional exports
  // 2. In server bundles, this code is completely eliminated by the bundler
  // 3. In client bundles, `isServer` is `false`, so the early return never executes
  // ==========================================================================

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const isHydrated = useHydrated()

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const _options = React.useMemo(
    () => options,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      router,
      options.from,
      options._fromLocation,
      options.hash,
      options.to,
      options.search,
      options.params,
      options.state,
      options.mask,
      options.unsafeRelative,
    ],
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const currentLocation = useStore(
    router.stores.location,
    (l) => l,
    (prev, next) => prev.href === next.href,
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const next = React.useMemo(() => {
    const opts = { _fromLocation: currentLocation, ..._options }
    return router.buildLocation(opts as any)
  }, [router, currentLocation, _options])

  // Use publicHref - it contains the correct href for display
  // When a rewrite changes the origin, publicHref is the full URL
  // Otherwise it's the origin-stripped path
  // This avoids constructing URL objects in the hot path
  const hrefOptionPublicHref = next.maskedLocation
    ? next.maskedLocation.publicHref
    : next.publicHref
  const hrefOptionExternal = next.maskedLocation
    ? next.maskedLocation.external
    : next.external
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const hrefOption = React.useMemo(
    () =>
      getHrefOption(
        hrefOptionPublicHref,
        hrefOptionExternal,
        router.history,
        disabled,
      ),
    [disabled, hrefOptionExternal, hrefOptionPublicHref, router.history],
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const externalLink = React.useMemo(() => {
    if (hrefOption?.external) {
      // Block dangerous protocols for external links
      if (isDangerousProtocol(hrefOption.href, router.protocolAllowlist)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `Blocked Link with dangerous protocol: ${hrefOption.href}`,
          )
        }
        return undefined
      }
      return hrefOption.href
    }
    const safeInternal = isSafeInternal(to)
    if (safeInternal) return undefined
    if (typeof to !== 'string' || to.indexOf(':') === -1) return undefined
    try {
      new URL(to as any)
      // Block dangerous protocols like javascript:, blob:, data:
      if (isDangerousProtocol(to, router.protocolAllowlist)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Blocked Link with dangerous protocol: ${to}`)
        }
        return undefined
      }
      return to
    } catch {}
    return undefined
  }, [to, hrefOption, router.protocolAllowlist])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const isActive = React.useMemo(() => {
    if (externalLink) return false
    if (activeOptions?.exact) {
      const testExact = exactPathTest(
        currentLocation.pathname,
        next.pathname,
        router.basepath,
      )
      if (!testExact) {
        return false
      }
    } else {
      const currentPathSplit = removeTrailingSlash(
        currentLocation.pathname,
        router.basepath,
      )
      const nextPathSplit = removeTrailingSlash(next.pathname, router.basepath)

      const pathIsFuzzyEqual =
        currentPathSplit.startsWith(nextPathSplit) &&
        (currentPathSplit.length === nextPathSplit.length ||
          currentPathSplit[nextPathSplit.length] === '/')

      if (!pathIsFuzzyEqual) {
        return false
      }
    }

    if (activeOptions?.includeSearch ?? true) {
      const searchTest = deepEqual(currentLocation.search, next.search, {
        partial: !activeOptions?.exact,
        ignoreUndefined: !activeOptions?.explicitUndefined,
      })
      if (!searchTest) {
        return false
      }
    }

    if (activeOptions?.includeHash) {
      return isHydrated && currentLocation.hash === next.hash
    }
    return true
  }, [
    activeOptions?.exact,
    activeOptions?.explicitUndefined,
    activeOptions?.includeHash,
    activeOptions?.includeSearch,
    currentLocation,
    externalLink,
    isHydrated,
    next.hash,
    next.pathname,
    next.search,
    router.basepath,
  ])

  // Get the active props
  const resolvedActiveProps: React.HTMLAttributes<HTMLAnchorElement> = isActive
    ? (functionalUpdate(activeProps as any, {}) ?? STATIC_ACTIVE_OBJECT)
    : STATIC_EMPTY_OBJECT

  // Get the inactive props
  const resolvedInactiveProps: React.HTMLAttributes<HTMLAnchorElement> =
    isActive
      ? STATIC_EMPTY_OBJECT
      : (functionalUpdate(inactiveProps, {}) ?? STATIC_EMPTY_OBJECT)

  const resolvedClassName = [
    className,
    resolvedActiveProps.className,
    resolvedInactiveProps.className,
  ]
    .filter(Boolean)
    .join(' ')

  const resolvedStyle = (style ||
    resolvedActiveProps.style ||
    resolvedInactiveProps.style) && {
    ...style,
    ...resolvedActiveProps.style,
    ...resolvedInactiveProps.style,
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isTransitioning, setIsTransitioning] = React.useState(false)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const hasRenderFetched = React.useRef(false)

  const preload =
    options.reloadDocument || externalLink
      ? false
      : (userPreload ?? router.options.defaultPreload)
  const preloadDelay =
    userPreloadDelay ?? router.options.defaultPreloadDelay ?? 0

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const doPreload = React.useCallback(() => {
    router
      .preloadRoute({ ..._options, _builtLocation: next } as any)
      .catch((err) => {
        console.warn(err)
        console.warn(preloadWarning)
      })
  }, [router, _options, next])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const preloadViewportIoCallback = React.useCallback(
    (entry: IntersectionObserverEntry | undefined) => {
      if (entry?.isIntersecting) {
        doPreload()
      }
    },
    [doPreload],
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useIntersectionObserver(
    innerRef,
    preloadViewportIoCallback,
    intersectionObserverOptions,
    { disabled: !!disabled || !(preload === 'viewport') },
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (hasRenderFetched.current) {
      return
    }
    if (!disabled && preload === 'render') {
      doPreload()
      hasRenderFetched.current = true
    }
  }, [disabled, doPreload, preload])

  // The click handler
  const handleClick = (e: React.MouseEvent) => {
    // Check actual element's target attribute as fallback
    const elementTarget = (
      e.currentTarget as HTMLAnchorElement | SVGAElement
    ).getAttribute('target')
    const effectiveTarget = target !== undefined ? target : elementTarget

    if (
      !disabled &&
      !isCtrlEvent(e) &&
      !e.defaultPrevented &&
      (!effectiveTarget || effectiveTarget === '_self') &&
      e.button === 0
    ) {
      e.preventDefault()

      flushSync(() => {
        setIsTransitioning(true)
      })

      const unsub = router.subscribe('onResolved', () => {
        unsub()
        setIsTransitioning(false)
      })

      // All is well? Navigate!
      // N.B. we don't call `router.commitLocation(next) here because we want to run `validateSearch` before committing
      router.navigate({
        ..._options,
        replace,
        resetScroll,
        hashScrollIntoView,
        startTransition,
        viewTransition,
        ignoreBlocker,
      })
    }
  }

  if (externalLink) {
    return {
      ...propsSafeToSpread,
      ref: innerRef as React.ComponentPropsWithRef<'a'>['ref'],
      href: externalLink,
      ...(children && { children }),
      ...(target && { target }),
      ...(disabled && { disabled }),
      ...(style && { style }),
      ...(className && { className }),
      ...(onClick && { onClick }),
      ...(onBlur && { onBlur }),
      ...(onFocus && { onFocus }),
      ...(onMouseEnter && { onMouseEnter }),
      ...(onMouseLeave && { onMouseLeave }),
      ...(onTouchStart && { onTouchStart }),
    }
  }

  const enqueueIntentPreload = (e: React.MouseEvent | React.FocusEvent) => {
    if (disabled || preload !== 'intent') return

    if (!preloadDelay) {
      doPreload()
      return
    }

    const eventTarget = e.currentTarget

    if (timeoutMap.has(eventTarget)) {
      return
    }

    const id = setTimeout(() => {
      timeoutMap.delete(eventTarget)
      doPreload()
    }, preloadDelay)
    timeoutMap.set(eventTarget, id)
  }

  const handleTouchStart = (_: React.TouchEvent) => {
    if (disabled || preload !== 'intent') return
    doPreload()
  }

  const handleLeave = (e: React.MouseEvent | React.FocusEvent) => {
    if (disabled || !preload || !preloadDelay) return
    const eventTarget = e.currentTarget
    const id = timeoutMap.get(eventTarget)
    if (id) {
      clearTimeout(id)
      timeoutMap.delete(eventTarget)
    }
  }

  return {
    ...propsSafeToSpread,
    ...resolvedActiveProps,
    ...resolvedInactiveProps,
    href: hrefOption?.href,
    ref: innerRef as React.ComponentPropsWithRef<'a'>['ref'],
    onClick: composeHandlers([onClick, handleClick]),
    onBlur: composeHandlers([onBlur, handleLeave]),
    onFocus: composeHandlers([onFocus, enqueueIntentPreload]),
    onMouseEnter: composeHandlers([onMouseEnter, enqueueIntentPreload]),
    onMouseLeave: composeHandlers([onMouseLeave, handleLeave]),
    onTouchStart: composeHandlers([onTouchStart, handleTouchStart]),
    disabled: !!disabled,
    target,
    ...(resolvedStyle && { style: resolvedStyle }),
    ...(resolvedClassName && { className: resolvedClassName }),
    ...(disabled && STATIC_DISABLED_PROPS),
    ...(isActive && STATIC_ACTIVE_PROPS),
    ...(isHydrated && isTransitioning && STATIC_TRANSITIONING_PROPS),
  }
}

const STATIC_EMPTY_OBJECT = {}
const STATIC_ACTIVE_OBJECT = { className: 'active' }
const STATIC_DISABLED_PROPS = { role: 'link', 'aria-disabled': true }
const STATIC_ACTIVE_PROPS = { 'data-status': 'active', 'aria-current': 'page' }
const STATIC_TRANSITIONING_PROPS = { 'data-transitioning': 'transitioning' }

const timeoutMap = new WeakMap<EventTarget, ReturnType<typeof setTimeout>>()

const intersectionObserverOptions: IntersectionObserverInit = {
  rootMargin: '100px',
}

const composeHandlers =
  (handlers: Array<undefined | React.EventHandler<any>>) =>
  (e: React.SyntheticEvent) => {
    for (const handler of handlers) {
      if (!handler) continue
      if (e.defaultPrevented) return
      handler(e)
    }
  }

function getHrefOption(
  publicHref: string,
  external: boolean,
  history: AnyRouter['history'],
  disabled: boolean | undefined,
) {
  if (disabled) return undefined
  // Full URL means rewrite changed the origin - treat as external-like
  if (external) {
    return { href: publicHref, external: true }
  }
  return {
    href: history.createHref(publicHref) || '/',
    external: false,
  }
}

function isSafeInternal(to: unknown) {
  if (typeof to !== 'string') return false
  const zero = to.charCodeAt(0)
  if (zero === 47) return to.charCodeAt(1) !== 47 // '/' but not '//'
  return zero === 46 // '.', '..', './', '../'
}

type UseLinkReactProps<TComp> = TComp extends keyof React.JSX.IntrinsicElements
  ? React.JSX.IntrinsicElements[TComp]
  : TComp extends React.ComponentType<any>
    ? React.ComponentPropsWithoutRef<TComp> &
        React.RefAttributes<React.ComponentRef<TComp>>
    : never

export type UseLinkPropsOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends RoutePaths<TRouter['routeTree']> | string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends RoutePaths<TRouter['routeTree']> | string = TFrom,
  TMaskTo extends string = '.',
> = ActiveLinkOptions<'a', TRouter, TFrom, TTo, TMaskFrom, TMaskTo> &
  UseLinkReactProps<'a'>

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
  LinkComponentReactProps<TComp> & {
    [key: `data-${string}`]: unknown
  }
>

export interface ActiveLinkOptionProps<TComp = 'a'> {
  /**
   * A function that returns additional props for the `active` state of this link.
   * These props override other props passed to the link (`style`'s are merged, `className`'s are concatenated)
   */
  activeProps?: ActiveLinkProps<TComp> | (() => ActiveLinkProps<TComp>)
  /**
   * A function that returns additional props for the `inactive` state of this link.
   * These props override other props passed to the link (`style`'s are merged, `className`'s are concatenated)
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
    | React.ReactNode
    | ((state: {
        isActive: boolean
        isTransitioning: boolean
      }) => React.ReactNode)
}

type LinkComponentReactProps<TComp> = Omit<
  UseLinkReactProps<TComp>,
  keyof CreateLinkProps
>

export type LinkComponentProps<
  TComp = 'a',
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = '.',
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '.',
> = LinkComponentReactProps<TComp> &
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
) => React.ReactElement

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
  ): React.ReactElement
}

/**
 * Creates a typed Link-like component that preserves TanStack Router's
 * navigation semantics and type-safety while delegating rendering to the
 * provided host component.
 *
 * Useful for integrating design system anchors/buttons while keeping
 * router-aware props (eg. `to`, `params`, `search`, `preload`).
 *
 * @param Comp The host component to render (eg. a design-system Link/Button)
 * @returns A router-aware component with the same API as `Link`.
 * @link https://tanstack.com/router/latest/docs/framework/react/guide/custom-link
 */
export function createLink<const TComp>(
  Comp: Constrain<TComp, any, (props: CreateLinkProps) => ReactNode>,
): LinkComponent<TComp> {
  return React.forwardRef(function CreatedLink(props, ref) {
    return <Link {...(props as any)} _asChild={Comp} ref={ref} />
  }) as any
}

/**
 * A strongly-typed anchor component for declarative navigation.
 * Handles path, search, hash and state updates with optional route preloading
 * and active-state styling.
 *
 * Props:
 * - `preload`: Controls route preloading (eg. 'intent', 'render', 'viewport', true/false)
 * - `preloadDelay`: Delay in ms before preloading on hover
 * - `activeProps`/`inactiveProps`: Additional props merged when link is active/inactive
 * - `resetScroll`/`hashScrollIntoView`: Control scroll behavior on navigation
 * - `viewTransition`/`startTransition`: Use View Transitions/React transitions for navigation
 * - `ignoreBlocker`: Bypass registered blockers
 *
 * @returns An anchor-like element that navigates without full page reloads.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/linkComponent
 */
export const Link: LinkComponent<'a'> = React.forwardRef<Element, any>(
  (props, ref) => {
    const { _asChild, ...rest } = props
    const { type: _type, ...linkProps } = useLinkProps(rest as any, ref)

    const children =
      typeof rest.children === 'function'
        ? rest.children({
            isActive: (linkProps as any)['data-status'] === 'active',
          })
        : rest.children

    if (!_asChild) {
      // the ReturnType of useLinkProps returns the correct type for a <a> element, not a general component that has a disabled prop
      // @ts-expect-error
      const { disabled: _, ...rest } = linkProps
      return React.createElement('a', rest, children)
    }
    return React.createElement(_asChild, linkProps, children)
  },
) as any

function isCtrlEvent(e: React.MouseEvent) {
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

/**
 * Validate and reuse navigation options for `Link`, `navigate` or `redirect`.
 * Accepts a literal options object and returns it typed for later spreading.
 * @example
 * const opts = linkOptions({ to: '/dashboard', search: { tab: 'home' } })
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/linkOptions
 */
export const linkOptions: LinkOptionsFn<'a'> = (options) => {
  return options as any
}

/**
 * Type-check a literal object for use with `Link`, `navigate` or `redirect`.
 * Use to validate and reuse navigation options across your app.
 * @example
 * const opts = linkOptions({ to: '/dashboard', search: { tab: 'home' } })
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/linkOptions
 */
