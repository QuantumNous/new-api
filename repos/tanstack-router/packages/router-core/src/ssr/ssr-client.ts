import { invariant } from '../invariant'
import { isNotFound } from '../not-found'
import { createControlledPromise } from '../utils'
import { hydrateSsrMatchId } from './ssr-match-id'
import type { GLOBAL_SEROVAL, GLOBAL_TSR } from './constants'
import type { DehydratedMatch, TsrSsrGlobal } from './types'
import type { AnyRouteMatch } from '../Matches'
import type { AnyRouter } from '../router'
import type { RouteContextOptions } from '../route'
import type { AnySerializationAdapter } from './serializer/transformer'

declare global {
  interface Window {
    [GLOBAL_TSR]?: TsrSsrGlobal
    [GLOBAL_SEROVAL]?: any
  }
}

function hydrateMatch(
  match: AnyRouteMatch,
  deyhydratedMatch: DehydratedMatch,
): void {
  match.id = deyhydratedMatch.i
  match.__beforeLoadContext = deyhydratedMatch.b
  match.loaderData = deyhydratedMatch.l
  match.status = deyhydratedMatch.s
  match.ssr = deyhydratedMatch.ssr
  match.updatedAt = deyhydratedMatch.u
  match.error = deyhydratedMatch.e
  // Only hydrate global-not-found when a defined value is present in the
  // dehydrated payload. If omitted, preserve the value computed from the
  // current client location (important for SPA fallback HTML served at unknown
  // URLs, where dehydrated matches may come from `/` but client matching marks
  // root as globalNotFound).
  if (deyhydratedMatch.g !== undefined) {
    match.globalNotFound = deyhydratedMatch.g
  }
}

export async function hydrate(router: AnyRouter): Promise<any> {
  if (!window.$_TSR) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        'Invariant failed: Expected to find bootstrap data on window.$_TSR, but we did not. Please file an issue!',
      )
    }

    invariant()
  }

  const serializationAdapters = router.options.serializationAdapters as
    | Array<AnySerializationAdapter>
    | undefined

  if (serializationAdapters?.length) {
    const fromSerializableMap = new Map()
    serializationAdapters.forEach((adapter) => {
      fromSerializableMap.set(adapter.key, adapter.fromSerializable)
    })
    window.$_TSR.t = fromSerializableMap
    window.$_TSR.buffer.forEach((script) => script())
  }
  window.$_TSR.initialized = true

  if (!window.$_TSR.router) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        'Invariant failed: Expected to find a dehydrated data on window.$_TSR.router, but we did not. Please file an issue!',
      )
    }

    invariant()
  }

  const dehydratedRouter = window.$_TSR.router
  dehydratedRouter.matches.forEach((dehydratedMatch) => {
    dehydratedMatch.i = hydrateSsrMatchId(dehydratedMatch.i)
  })
  if (dehydratedRouter.lastMatchId) {
    dehydratedRouter.lastMatchId = hydrateSsrMatchId(
      dehydratedRouter.lastMatchId,
    )
  }
  const { manifest, dehydratedData, lastMatchId } = dehydratedRouter

  router.ssr = {
    manifest,
  }
  const meta = document.querySelector('meta[property="csp-nonce"]') as
    | HTMLMetaElement
    | undefined
  const nonce = meta?.content
  router.options.ssr = {
    nonce,
  }

  // Allow the user to handle custom hydration data before matching routes.
  // This lets hydration install router config that affects matching, e.g. rewrites.
  await router.options.hydrate?.(dehydratedData)

  // Hydrate the router state
  const matches = router.matchRoutes(router.stores.location.get())

  // kick off loading the route chunks
  const routeChunkPromise = Promise.all(
    matches.map((match) =>
      router.loadRouteChunk(router.looseRoutesById[match.routeId]!),
    ),
  )

  function setMatchForcePending(match: AnyRouteMatch) {
    // usually the minPendingPromise is created in the Match component if a pending match is rendered
    // however, this might be too late if the match synchronously resolves
    const route = router.looseRoutesById[match.routeId]!
    const pendingMinMs =
      route.options.pendingMinMs ?? router.options.defaultPendingMinMs
    if (pendingMinMs) {
      const minPendingPromise = createControlledPromise<void>()
      match._nonReactive.minPendingPromise = minPendingPromise
      match._forcePending = true

      setTimeout(() => {
        minPendingPromise.resolve()
        // We've handled the minPendingPromise, so we can delete it
        router.updateMatch(match.id, (prev) => {
          prev._nonReactive.minPendingPromise = undefined
          return {
            ...prev,
            _forcePending: undefined,
          }
        })
      }, pendingMinMs)
    }
  }

  function setRouteSsr(match: AnyRouteMatch) {
    const route = router.looseRoutesById[match.routeId]
    if (route) {
      route.options.ssr = match.ssr
    }
  }
  // Right after hydration and before the first render, we need to rehydrate each match
  // First step is to reyhdrate loaderData and __beforeLoadContext
  let firstNonSsrMatchIndex: number | undefined = undefined
  matches.forEach((match) => {
    const dehydratedMatch = dehydratedRouter.matches.find(
      (d) => d.i === match.id,
    )
    if (!dehydratedMatch) {
      match._nonReactive.dehydrated = false
      match.ssr = false
      setRouteSsr(match)
      return
    }

    hydrateMatch(match, dehydratedMatch)
    setRouteSsr(match)

    match._nonReactive.dehydrated = match.ssr !== false

    if (match.ssr === 'data-only' || match.ssr === false) {
      if (firstNonSsrMatchIndex === undefined) {
        firstNonSsrMatchIndex = match.index
        setMatchForcePending(match)
      }
    }
  })

  router.stores.setMatches(matches)

  // now that all necessary data is hydrated:
  // 1) fully reconstruct the route context
  // 2) execute `head()` and `scripts()` for each match
  const activeMatches = router.stores.matches.get()
  const location = router.stores.location.get()
  await Promise.all(
    activeMatches.map(async (match) => {
      try {
        const route = router.looseRoutesById[match.routeId]!

        const parentMatch = activeMatches[match.index - 1]
        const parentContext = parentMatch?.context ?? router.options.context

        // `context()` was already executed by `matchRoutes`, however route context was not yet fully reconstructed
        // so run it again and merge route context
        if (route.options.context) {
          const contextFnContext: RouteContextOptions<any, any, any, any, any> =
            {
              deps: match.loaderDeps,
              params: match.params,
              context: parentContext ?? {},
              location,
              navigate: (opts: any) =>
                router.navigate({
                  ...opts,
                  _fromLocation: location,
                }),
              buildLocation: router.buildLocation,
              cause: match.cause,
              abortController: match.abortController,
              preload: false,
              matches,
              routeId: route.id,
            }
          match.__routeContext =
            route.options.context(contextFnContext) ?? undefined
        }

        match.context = {
          ...parentContext,
          ...match.__routeContext,
          ...match.__beforeLoadContext,
        }

        const assetContext = {
          ssr: router.options.ssr,
          matches: activeMatches,
          match,
          params: match.params,
          loaderData: match.loaderData,
        }
        const headFnContent = await route.options.head?.(assetContext)

        const scripts = await route.options.scripts?.(assetContext)

        match.meta = headFnContent?.meta
        match.links = headFnContent?.links
        match.headScripts = headFnContent?.scripts
        match.styles = headFnContent?.styles
        match.scripts = scripts
      } catch (err) {
        if (isNotFound(err)) {
          match.error = { isNotFound: true }
          console.error(
            `NotFound error during hydration for routeId: ${match.routeId}`,
            err,
          )
        } else {
          match.error = err as any
          console.error(
            `Error during hydration for route ${match.routeId}:`,
            err,
          )
          throw err
        }
      }
    }),
  )

  const isSpaMode = matches[matches.length - 1]!.id !== lastMatchId
  const hasSsrFalseMatches = matches.some((m) => m.ssr === false)
  // all matches have data from the server and we are not in SPA mode so we don't need to kick of router.load()
  if (!hasSsrFalseMatches && !isSpaMode) {
    matches.forEach((match) => {
      // remove the dehydrated flag since we won't run router.load() which would remove it
      match._nonReactive.dehydrated = undefined
    })
    // Mark the current location as resolved so that later load cycles
    // (e.g. preloads, invalidations) don't mistakenly detect a href change
    // (resolvedLocation defaults to undefined and router.load() is skipped
    // in the normal SSR hydration path).
    router.stores.resolvedLocation.set(router.stores.location.get())
    return routeChunkPromise
  }

  // schedule router.load() to run after the next tick so we can store the promise in the match before loading starts
  const loadPromise = Promise.resolve()
    .then(() => router.load())
    .catch((err) => {
      console.error('Error during router hydration:', err)
    })

  // in SPA mode we need to keep the first match below the root route pending until router.load() is finished
  // this will prevent that other pending components are rendered but hydration is not blocked
  if (isSpaMode) {
    const match = matches[1]
    if (!match) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          'Invariant failed: Expected to find a match below the root match in SPA mode.',
        )
      }

      invariant()
    }
    setMatchForcePending(match)

    match._displayPending = true
    match._nonReactive.displayPendingPromise = loadPromise

    loadPromise.then(() => {
      router.batch(() => {
        // ensure router is not in status 'pending' anymore
        // this usually happens in Transitioner but if loading synchronously resolves,
        // Transitioner won't be rendered while loading so it cannot track the change from loading:true to loading:false
        if (router.stores.status.get() === 'pending') {
          router.stores.status.set('idle')
          router.stores.resolvedLocation.set(router.stores.location.get())
        }
        // hide the pending component once the load is finished
        router.updateMatch(match.id, (prev) => ({
          ...prev,
          _displayPending: undefined,
          displayPendingPromise: undefined,
        }))
      })
    })
  }
  return routeChunkPromise
}
