import * as Solid from 'solid-js'
import {
  createControlledPromise,
  getLocationChangeInfo,
  invariant,
  isNotFound,
  isRedirect,
  rootRouteId,
} from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { Dynamic } from 'solid-js/web'
import { CatchBoundary, ErrorComponent } from './CatchBoundary'
import { useRouter } from './useRouter'
import { CatchNotFound, getNotFound } from './not-found'
import { nearestMatchContext } from './matchContext'
import { SafeFragment } from './SafeFragment'
import { renderRouteNotFound } from './renderRouteNotFound'
import { ScrollRestoration } from './scroll-restoration'
import type { AnyRoute, RootRouteOptions } from '@tanstack/router-core'

export const Match = (props: { matchId: string }) => {
  const router = useRouter()

  const match = Solid.createMemo(() => {
    const id = props.matchId
    if (!id) return undefined
    return router.stores.matchStores.get(id)?.get()
  })

  const rawMatchState = Solid.createMemo(() => {
    const currentMatch = match()
    if (!currentMatch) {
      return null
    }

    const routeId = currentMatch.routeId as string
    const parentRouteId = (router.routesById[routeId] as AnyRoute)?.parentRoute
      ?.id

    return {
      matchId: currentMatch.id,
      routeId,
      ssr: currentMatch.ssr,
      _displayPending: currentMatch._displayPending,
      parentRouteId: parentRouteId as string | undefined,
    }
  })

  const hasPendingMatch = Solid.createMemo(() => {
    const currentRouteId = rawMatchState()?.routeId
    return currentRouteId
      ? Boolean(router.stores.pendingRouteIds.get()[currentRouteId])
      : false
  })
  const nearestMatch = {
    matchId: () => rawMatchState()?.matchId,
    routeId: () => rawMatchState()?.routeId,
    match,
    hasPending: hasPendingMatch,
  }

  return (
    <Solid.Show when={rawMatchState()}>
      {(currentMatchState) => {
        const route: () => AnyRoute = () =>
          router.routesById[currentMatchState().routeId]

        const resolvePendingComponent = () =>
          route().options.pendingComponent ??
          router.options.defaultPendingComponent

        const routeErrorComponent = () =>
          route().options.errorComponent ?? router.options.defaultErrorComponent

        const routeOnCatch = () =>
          route().options.onCatch ?? router.options.defaultOnCatch

        const routeNotFoundComponent = () =>
          route().isRoot
            ? // If it's the root route, use the globalNotFound option, with fallback to the notFoundRoute's component
              (route().options.notFoundComponent ??
              router.options.notFoundRoute?.options.component)
            : route().options.notFoundComponent

        const resolvedNoSsr =
          currentMatchState().ssr === false ||
          currentMatchState().ssr === 'data-only'

        const shouldSkipSuspenseFallback =
          (isServer ?? router.isServer)
            ? resolvedNoSsr
            : currentMatchState().ssr === 'data-only'

        const ResolvedSuspenseBoundary = () => Solid.Suspense

        const ResolvedCatchBoundary = () =>
          routeErrorComponent() ? CatchBoundary : SafeFragment

        const ResolvedNotFoundBoundary = () =>
          routeNotFoundComponent() ? CatchNotFound : SafeFragment

        const ShellComponent = route().isRoot
          ? ((route().options as RootRouteOptions).shellComponent ??
            SafeFragment)
          : SafeFragment

        return (
          <ShellComponent>
            <nearestMatchContext.Provider value={nearestMatch}>
              <Dynamic
                component={ResolvedSuspenseBoundary()}
                fallback={
                  // Data-only SSR renders the inner fallback on the server, so
                  // avoid adding an extra suspense fallback on the client.
                  shouldSkipSuspenseFallback ? undefined : (
                    <Dynamic component={resolvePendingComponent()} />
                  )
                }
              >
                <Dynamic
                  component={ResolvedCatchBoundary()}
                  getResetKey={() => router.stores.loadedAt.get()}
                  errorComponent={routeErrorComponent() || ErrorComponent}
                  onCatch={(error: Error) => {
                    // Forward not found errors (we don't want to show the error component for these)
                    const notFoundError = getNotFound(error)
                    if (notFoundError) {
                      notFoundError.routeId ??= currentMatchState()
                        .routeId as any
                      throw notFoundError
                    }
                    if (process.env.NODE_ENV !== 'production') {
                      console.warn(
                        `Warning: Error in route match: ${currentMatchState().routeId}`,
                      )
                    }
                    routeOnCatch()?.(error)
                  }}
                >
                  <Dynamic
                    component={ResolvedNotFoundBoundary()}
                    fallback={(error: any) => {
                      const notFoundError = getNotFound(error) ?? error

                      notFoundError.routeId ??= currentMatchState()
                        .routeId as any

                      // If the current not found handler doesn't exist or it has a
                      // route ID which doesn't match the current route, rethrow the error
                      if (
                        !routeNotFoundComponent() ||
                        (notFoundError.routeId &&
                          notFoundError.routeId !==
                            currentMatchState().routeId) ||
                        (!notFoundError.routeId && !route().isRoot)
                      )
                        throw notFoundError

                      return (
                        <Dynamic
                          component={routeNotFoundComponent()}
                          {...notFoundError}
                        />
                      )
                    }}
                  >
                    <Solid.Switch>
                      <Solid.Match when={resolvedNoSsr}>
                        <Solid.Show
                          when={!(isServer ?? router.isServer)}
                          fallback={
                            <Dynamic component={resolvePendingComponent()} />
                          }
                        >
                          <MatchInner />
                        </Solid.Show>
                      </Solid.Match>
                      <Solid.Match when={!resolvedNoSsr}>
                        <MatchInner />
                      </Solid.Match>
                    </Solid.Switch>
                  </Dynamic>
                </Dynamic>
              </Dynamic>
            </nearestMatchContext.Provider>

            {currentMatchState().parentRouteId === rootRouteId ? (
              <>
                <OnRendered />
                {router.options.scrollRestoration &&
                (isServer ?? router.isServer) ? (
                  <ScrollRestoration />
                ) : null}
              </>
            ) : null}
          </ShellComponent>
        )
      }}
    </Solid.Show>
  )
}

// On Rendered can't happen above the root layout because it needs to run
// after the app has committed below the root layout. Keeping it here lets us
// fire onRendered even after a hydration mismatch above the root layout
// (like bad head/link tags, which is common).
function OnRendered() {
  const router = useRouter()

  const location = Solid.createMemo(
    () => router.stores.resolvedLocation.get()?.state.__TSR_key,
  )
  Solid.createEffect(
    Solid.on([location], () => {
      router.emit({
        type: 'onRendered',
        ...getLocationChangeInfo(
          router.stores.location.get(),
          router.stores.resolvedLocation.get(),
        ),
      })
    }),
  )
  return null
}

export const MatchInner = (): any => {
  const router = useRouter()
  const match = Solid.useContext(nearestMatchContext).match

  const rawMatchState = Solid.createMemo(() => {
    const currentMatch = match()
    if (!currentMatch) {
      return null
    }

    const routeId = currentMatch.routeId as string

    const remountFn =
      (router.routesById[routeId] as AnyRoute).options.remountDeps ??
      router.options.defaultRemountDeps
    const remountDeps = remountFn?.({
      routeId,
      loaderDeps: currentMatch.loaderDeps,
      params: currentMatch._strictParams,
      search: currentMatch._strictSearch,
    })
    const key = remountDeps ? JSON.stringify(remountDeps) : undefined

    return {
      key,
      routeId,
      match: {
        id: currentMatch.id,
        status: currentMatch.status,
        error: currentMatch.error,
        _forcePending: currentMatch._forcePending ?? false,
        _displayPending: currentMatch._displayPending ?? false,
      },
    }
  })

  return (
    <Solid.Show when={rawMatchState()}>
      {(currentMatchState) => {
        const route = () => router.routesById[currentMatchState().routeId]!

        const currentMatch = () => currentMatchState().match

        const componentKey = () =>
          currentMatchState().key ?? currentMatchState().match.id

        const out = () => {
          const Comp =
            route().options.component ?? router.options.defaultComponent
          if (Comp) {
            return <Comp />
          }
          return <Outlet />
        }

        const getLoadPromise = (
          matchId: string,
          fallbackMatch:
            | {
                _nonReactive: {
                  loadPromise?: Promise<void>
                }
              }
            | undefined,
        ) => {
          return (
            router.getMatch(matchId)?._nonReactive.loadPromise ??
            fallbackMatch?._nonReactive.loadPromise
          )
        }

        const keyedOut = () => (
          <Solid.Show when={componentKey()} keyed>
            {(_key) => out()}
          </Solid.Show>
        )

        return (
          <Solid.Switch>
            <Solid.Match when={currentMatch()._displayPending}>
              {(_) => {
                const [displayPendingResult] = Solid.createResource(
                  () =>
                    router.getMatch(currentMatch().id)?._nonReactive
                      .displayPendingPromise,
                )

                return <>{displayPendingResult()}</>
              }}
            </Solid.Match>
            <Solid.Match when={currentMatch()._forcePending}>
              {(_) => {
                const [minPendingResult] = Solid.createResource(
                  () =>
                    router.getMatch(currentMatch().id)?._nonReactive
                      .minPendingPromise,
                )

                return <>{minPendingResult()}</>
              }}
            </Solid.Match>
            <Solid.Match when={currentMatch().status === 'pending'}>
              {(_) => {
                const pendingMinMs =
                  route().options.pendingMinMs ??
                  router.options.defaultPendingMinMs

                if (pendingMinMs) {
                  const routerMatch = router.getMatch(currentMatch().id)
                  if (
                    routerMatch &&
                    !routerMatch._nonReactive.minPendingPromise
                  ) {
                    // Create a promise that will resolve after the minPendingMs
                    if (!(isServer ?? router.isServer)) {
                      const minPendingPromise = createControlledPromise<void>()

                      routerMatch._nonReactive.minPendingPromise =
                        minPendingPromise

                      setTimeout(() => {
                        minPendingPromise.resolve()
                        // We've handled the minPendingPromise, so we can delete it
                        routerMatch._nonReactive.minPendingPromise = undefined
                      }, pendingMinMs)
                    }
                  }
                }

                const [loaderResult] = Solid.createResource(async () => {
                  await Promise.resolve()
                  return router.getMatch(currentMatch().id)?._nonReactive
                    .loadPromise
                })

                const FallbackComponent =
                  route().options.pendingComponent ??
                  router.options.defaultPendingComponent

                return (
                  <>
                    {FallbackComponent && pendingMinMs > 0 ? (
                      <Dynamic component={FallbackComponent} />
                    ) : null}
                    {loaderResult()}
                  </>
                )
              }}
            </Solid.Match>
            <Solid.Match when={currentMatch().status === 'notFound'}>
              {(_) => {
                if (!isNotFound(currentMatch().error)) {
                  if (process.env.NODE_ENV !== 'production') {
                    throw new Error(
                      'Invariant failed: Expected a notFound error',
                    )
                  }

                  invariant()
                }

                // Use Show with keyed to ensure re-render when routeId changes
                return (
                  <Solid.Show when={currentMatchState().routeId} keyed>
                    {(_routeId) =>
                      renderRouteNotFound(router, route(), currentMatch().error)
                    }
                  </Solid.Show>
                )
              }}
            </Solid.Match>
            <Solid.Match when={currentMatch().status === 'redirected'}>
              {(_) => {
                const matchId = currentMatch().id
                const routerMatch = router.getMatch(matchId)

                if (!isRedirect(currentMatch().error)) {
                  if (process.env.NODE_ENV !== 'production') {
                    throw new Error(
                      'Invariant failed: Expected a redirect error',
                    )
                  }

                  invariant()
                }

                const [loaderResult] = Solid.createResource(async () => {
                  await Promise.resolve()
                  return getLoadPromise(matchId, routerMatch)
                })

                return <>{loaderResult()}</>
              }}
            </Solid.Match>
            <Solid.Match when={currentMatch().status === 'error'}>
              {(_) => {
                if (isServer ?? router.isServer) {
                  const RouteErrorComponent =
                    (route().options.errorComponent ??
                      router.options.defaultErrorComponent) ||
                    ErrorComponent

                  return (
                    <RouteErrorComponent
                      error={currentMatch().error}
                      info={{
                        componentStack: '',
                      }}
                    />
                  )
                }

                throw currentMatch().error
              }}
            </Solid.Match>
            <Solid.Match when={currentMatch().status === 'success'}>
              {keyedOut()}
            </Solid.Match>
          </Solid.Switch>
        )
      }}
    </Solid.Show>
  )
}

export const Outlet = () => {
  const router = useRouter()
  const nearestParentMatch = Solid.useContext(nearestMatchContext)
  const parentMatch = nearestParentMatch.match
  const routeId = nearestParentMatch.routeId
  const route = Solid.createMemo(() =>
    routeId() ? router.routesById[routeId()!] : undefined,
  )

  const parentGlobalNotFound = Solid.createMemo(
    () => parentMatch()?.globalNotFound ?? false,
  )

  const childMatchId = Solid.createMemo(() => {
    const currentRouteId = routeId()
    return currentRouteId
      ? router.stores.childMatchIdByRouteId.get()[currentRouteId]
      : undefined
  })

  const childMatchStatus = Solid.createMemo(() => {
    const id = childMatchId()
    if (!id) return undefined
    return router.stores.matchStores.get(id)?.get().status
  })

  const shouldShowNotFound = () =>
    childMatchStatus() !== 'redirected' && parentGlobalNotFound()

  const childRouteKey = Solid.createMemo(() => {
    if (shouldShowNotFound()) return undefined
    const cid = childMatchId()
    if (!cid) return undefined
    return router.stores.matchStores.get(cid)?.routeId ?? cid
  })

  return (
    <Solid.Show
      when={childRouteKey()}
      keyed
      fallback={
        <Solid.Show when={shouldShowNotFound() && route()}>
          {(resolvedRoute) =>
            renderRouteNotFound(router, resolvedRoute(), undefined)
          }
        </Solid.Show>
      }
    >
      {(_routeKey: string) => {
        return (
          <Solid.Show
            when={routeId() === rootRouteId}
            fallback={<Match matchId={childMatchId()!} />}
          >
            <Solid.Suspense
              fallback={
                <Dynamic component={router.options.defaultPendingComponent} />
              }
            >
              <Match matchId={childMatchId()!} />
            </Solid.Suspense>
          </Solid.Show>
        )
      }}
    </Solid.Show>
  )
}
