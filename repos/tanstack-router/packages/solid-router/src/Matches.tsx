import * as Solid from 'solid-js'
import { replaceEqualDeep, rootRouteId } from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { CatchBoundary, ErrorComponent } from './CatchBoundary'
import { useRouter } from './useRouter'
import { Transitioner } from './Transitioner'
import { nearestMatchContext } from './matchContext'
import { SafeFragment } from './SafeFragment'
import { Match } from './Match'
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
    meta?: Array<Solid.JSX.IntrinsicElements['meta'] | undefined>
    links?: Array<Solid.JSX.IntrinsicElements['link'] | undefined>
    scripts?: Array<Solid.JSX.IntrinsicElements['script'] | undefined>
    styles?: Array<Solid.JSX.IntrinsicElements['style'] | undefined>
    headScripts?: Array<Solid.JSX.IntrinsicElements['script'] | undefined>
  }
}

export function Matches() {
  const router = useRouter()

  const ResolvedSuspense =
    (isServer ?? router.isServer) ||
    (typeof document !== 'undefined' && router.ssr)
      ? SafeFragment
      : Solid.Suspense

  const rootRoute: () => AnyRoute = () => router.routesById[rootRouteId]
  const PendingComponent =
    rootRoute().options.pendingComponent ??
    router.options.defaultPendingComponent

  const OptionalWrapper = router.options.InnerWrap || SafeFragment

  return (
    <OptionalWrapper>
      <ResolvedSuspense
        fallback={PendingComponent ? <PendingComponent /> : null}
      >
        <Transitioner />
        <MatchesInner />
      </ResolvedSuspense>
    </OptionalWrapper>
  )
}

function MatchesInner() {
  const router = useRouter()
  const matchId = () => router.stores.firstId.get()
  const routeId = () => (matchId() ? rootRouteId : undefined)
  const match = () =>
    routeId() ? router.stores.getRouteMatchStore(rootRouteId).get() : undefined
  const hasPendingMatch = () =>
    routeId()
      ? Boolean(router.stores.pendingRouteIds.get()[rootRouteId])
      : false
  const resetKey = () => router.stores.loadedAt.get()
  const nearestMatch = {
    matchId,
    routeId,
    match,
    hasPending: hasPendingMatch,
  }

  const matchComponent = () => {
    return (
      <Solid.Show when={matchId()}>
        <Match matchId={matchId()!} />
      </Solid.Show>
    )
  }

  return (
    <nearestMatchContext.Provider value={nearestMatch}>
      {router.options.disableGlobalCatchBoundary ? (
        matchComponent()
      ) : (
        <CatchBoundary
          getResetKey={() => resetKey()}
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
          {matchComponent()}
        </CatchBoundary>
      )}
    </nearestMatchContext.Provider>
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

export function useMatchRoute<TRouter extends AnyRouter = RegisteredRouter>() {
  const router = useRouter()

  return <
    const TFrom extends string = string,
    const TTo extends string | undefined = undefined,
    const TMaskFrom extends string = TFrom,
    const TMaskTo extends string = '',
  >(
    opts: UseMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
  ): Solid.Accessor<
    false | Expand<ResolveRoute<TRouter, TFrom, TTo>['types']['allParams']>
  > => {
    return Solid.createMemo(() => {
      const { pending, caseSensitive, fuzzy, includeSearch, ...rest } = opts

      router.stores.matchRouteDeps.get()
      return router.matchRoute(rest as any, {
        pending,
        caseSensitive,
        fuzzy,
        includeSearch,
      })
    })
  }
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
      ) => Solid.JSX.Element)
    | Solid.JSX.Element
}

export function MatchRoute<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = '',
>(props: MakeMatchRouteOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>): any {
  const matchRoute = useMatchRoute()
  const params = matchRoute(props as any)

  const renderedChild = Solid.createMemo(() => {
    const matchedParams = params()
    const child = props.children

    if (typeof child === 'function') {
      return (child as any)(matchedParams)
    }

    return matchedParams ? child : null
  })

  return <>{renderedChild()}</>
}

export interface UseMatchesBaseOptions<TRouter extends AnyRouter, TSelected> {
  select?: (matches: Array<MakeRouteMatchUnion<TRouter>>) => TSelected
}

export type UseMatchesResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? Array<MakeRouteMatchUnion<TRouter>> : TSelected

export function useMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Solid.Accessor<UseMatchesResult<TRouter, TSelected>> {
  const router = useRouter<TRouter>()
  return Solid.createMemo((prev: TSelected | undefined) => {
    const matches = router.stores.matches.get() as Array<
      MakeRouteMatchUnion<TRouter>
    >
    const res = opts?.select ? opts.select(matches) : matches
    if (prev === undefined) return res
    return replaceEqualDeep(prev, res) as any
  }) as Solid.Accessor<UseMatchesResult<TRouter, TSelected>>
}

export function useParentMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Solid.Accessor<UseMatchesResult<TRouter, TSelected>> {
  const contextMatchId = Solid.useContext(nearestMatchContext).matchId

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      matches = matches.slice(
        0,
        matches.findIndex((d) => d.id === contextMatchId()),
      )
      return opts?.select ? opts.select(matches) : matches
    },
  } as any)
}

export function useChildMatches<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchesBaseOptions<TRouter, TSelected>,
): Solid.Accessor<UseMatchesResult<TRouter, TSelected>> {
  const contextMatchId = Solid.useContext(nearestMatchContext).matchId

  return useMatches({
    select: (matches: Array<MakeRouteMatchUnion<TRouter>>) => {
      matches = matches.slice(
        matches.findIndex((d) => d.id === contextMatchId()) + 1,
      )
      return opts?.select ? opts.select(matches) : matches
    },
  } as any)
}
