'use client'

import * as React from 'react'
import { useStore } from '@tanstack/react-store'
import { rootRouteId } from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { CatchBoundary, ErrorComponent } from './CatchBoundary'
import { useRouter } from './useRouter'
import { useStructuralSharing } from './useMatch'
import { Transitioner } from './Transitioner'
import { matchContext } from './matchContext'
import { Match } from './Match'
import { SafeFragment } from './SafeFragment'
import type {
  StructuralSharingOption,
  ValidateSelected,
} from './structuralSharing'
import type {
  AnyRoute,
  AnyRouter,
  DeepPartial,
  Expand,
  MakeOptionalPathParams,
  MakeOptionalSearchParams,
  MakeRouteMatchUnion,
  MaskOptions,
  MatchRouteOptions,
  RegisteredRouter,
  ResolveRoute,
  ToSubOptionsProps,
} from '@tanstack/router-core'

declare module '@tanstack/router-core' {
  export interface RouteMatchExtensions {
    meta?: Array<React.JSX.IntrinsicElements['meta'] | undefined>
    links?: Array<React.JSX.IntrinsicElements['link'] | undefined>
    scripts?: Array<React.JSX.IntrinsicElements['script'] | undefined>
    styles?: Array<React.JSX.IntrinsicElements['style'] | undefined>
    headScripts?: Array<React.JSX.IntrinsicElements['script'] | undefined>
  }
}

/**
 * Internal component that renders the router's active match tree with
 * suspense, error, and not-found boundaries. Rendered by `RouterProvider`.
 */
export function Matches() {
  const router = useRouter()
  const rootRoute: AnyRoute = router.routesById[rootRouteId]

  const PendingComponent =
    rootRoute.options.pendingComponent ?? router.options.defaultPendingComponent

  const pendingElement = PendingComponent ? <PendingComponent /> : null

  // Do not render a root Suspense during SSR or hydrating from SSR
  const ResolvedSuspense =
    (isServer ?? router.isServer) ||
    (typeof document !== 'undefined' && router.ssr)
      ? SafeFragment
      : React.Suspense

  const inner = (
    <ResolvedSuspense fallback={pendingElement}>
      {!(isServer ?? router.isServer) && <Transitioner />}
      <MatchesInner />
    </ResolvedSuspense>
  )

  return router.options.InnerWrap ? (
    <router.options.InnerWrap>{inner}</router.options.InnerWrap>
  ) : (
    inner
  )
}

function MatchesInner() {
  const router = useRouter()
  const _isServer = isServer ?? router.isServer
  const matchId = _isServer
    ? router.stores.firstId.get()
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useStore(router.stores.firstId, (id) => id)
  const resetKey = _isServer
    ? router.stores.loadedAt.get()
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useStore(router.stores.loadedAt, (loadedAt) => loadedAt)

  const matchComponent = matchId ? <Match matchId={matchId} /> : null

  return (
    <matchContext.Provider value={matchId}>
      {router.options.disableGlobalCatchBoundary ? (
        matchComponent
      ) : (
        <CatchBoundary
          getResetKey={() => resetKey}
          errorComponent={ErrorComponent}
          onCatch={
            process.env.NODE_ENV !== 'production'
              ? (error) => {
                  console.warn(
                    `Warning: The following error wasn't caught by any route! At the very least, consider setting an 'errorComponent' in your RootRoute!`,
                  )
                  console.warn(`Warning: ${error.message || error.toString()}`)
                }
              : undefined
          }
        >
          {matchComponent}
        </CatchBoundary>
      )}
    </matchContext.Provider>
  )
}

export type UseMatchRouteOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = ToSubOptionsProps<TRouter, TFrom, TTo> &
  DeepPartial<MakeOptionalSearchParams<TRouter, TFrom, TTo>> &
  DeepPartial<MakeOptionalPathParams<TRouter, TFrom, TTo>> &
  MaskOptions<TRouter, TMaskFrom, TMaskTo> &
  MatchRouteOptions

/**
 * Create a matcher function for testing locations against route definitions.
 *
 * The returned function accepts standard navigation options (`to`, `params`,
 * `search`, etc.) and returns either `false` (no match) or the matched params
 * object when the route matches the current or pending location.
 *
 * Useful for conditional rendering and active UI states.
 *
 * @returns A `matchRoute(options)` function that returns `false` or params.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useMatchRouteHook
 */
export function useMatchRoute<TRouter extends AnyRouter = RegisteredRouter>() {
  const router = useRouter()

  if (!(isServer ?? router.isServer)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStore(router.stores.matchRouteDeps, (d) => d)
  }

  return React.useCallback(
    <
      const TFrom extends string = string,
      const TTo extends string | undefined = undefined,
      const TMaskFrom extends string = TFrom,
      const TMaskTo extends string = '',
    >(
      opts: UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
    ):
      | false
      | Expand<ResolveRoute<TRouter, TFrom, TTo>['types']['allParams']> => {
      const { pending, caseSensitive, fuzzy, includeSearch, ...rest } = opts

      return router.matchRoute(rest as any, {
        pending,
        caseSensitive,
        fuzzy,
        includeSearch,
      })
    },
    [router],
  )
}

export type MakeMatchRouteOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
> = UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
  // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
  children?:
    | ((
        params?: Expand<
          ResolveRoute<TRouter, TFrom, TTo>['types']['allParams']
        >,
      ) => React.ReactNode)
    | React.ReactNode
}

/**
 * Component that conditionally renders its children based on whether a route
 * matches the provided `from`/`to` options. If `children` is a function, it
 * receives the matched params object.
 *
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/matchRouteComponent
 */
export function MatchRoute<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = '',
>(props: MakeMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>): any {
  const matchRoute = useMatchRoute()
  const params = matchRoute(props as any) as boolean

  if (typeof props.children === 'function') {
    return (props.children as any)(params)
  }

  return params ? props.children : null
}

export interface UseMatchesBaseOptions<
  TRouter extends AnyRouter,
  TSelected,
  TStructuralSharing,
> {
  select?: (
    matches: Array<MakeRouteMatchUnion<TRouter>>,
  ) => ValidateSelected<TRouter, TSelected, TStructuralSharing>
}

export type UseMatchesResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? Array<MakeRouteMatchUnion<TRouter>> : TSelected

export function useMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected, TStructuralSharing> &
    StructuralSharingOption<TRouter, TSelected, TStructuralSharing>,
): UseMatchesResult<TRouter, TSelected> {
  const router = useRouter<TRouter>()

  if (isServer ?? router.isServer) {
    const matches = router.stores.matches.get() as Array<
      MakeRouteMatchUnion<TRouter>
    >
    return (opts?.select ? opts.select(matches) : matches) as UseMatchesResult<
      TRouter,
      TSelected
    >
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  return useStore(
    router.stores.matches,
    // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
    useStructuralSharing(opts, router),
  ) as UseMatchesResult<TRouter, TSelected>
}

/**
 * Read the full array of active route matches or select a derived subset.
 *
 * Useful for debugging, breadcrumbs, or aggregating metadata across matches.
 *
 * @returns The array of matches (or the selected value).
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useMatchesHook
 */

/**
 * Read the full array of active route matches or select a derived subset.
 *
 * Useful for debugging, breadcrumbs, or aggregating metadata across matches.
 *
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useMatchesHook
 */
export function useParentMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected, TStructuralSharing> &
    StructuralSharingOption<TRouter, TSelected, TStructuralSharing>,
): UseMatchesResult<TRouter, TSelected> {
  const contextMatchId = React.useContext(matchContext)

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      matches = matches.slice(
        0,
        matches.findIndex((d) => d.id === contextMatchId),
      )
      return opts?.select ? opts.select(matches) : matches
    },
    structuralSharing: opts?.structuralSharing,
  } as any)
}

/**
 * Read the array of active route matches that are children of the current
 * match (or selected parent) in the match tree.
 */
export function useChildMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected, TStructuralSharing> &
    StructuralSharingOption<TRouter, TSelected, TStructuralSharing>,
): UseMatchesResult<TRouter, TSelected> {
  const contextMatchId = React.useContext(matchContext)

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      matches = matches.slice(
        matches.findIndex((d) => d.id === contextMatchId) + 1,
      )
      return opts?.select ? opts.select(matches) : matches
    },
    structuralSharing: opts?.structuralSharing,
  } as any)
}
