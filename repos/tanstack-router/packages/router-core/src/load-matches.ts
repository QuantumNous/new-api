import { isServer } from '@tanstack/router-core/isServer'
import { invariant } from './invariant'
import { createControlledPromise, isPromise } from './utils'
import { isNotFound } from './not-found'
import { rootRouteId } from './root'
import { isRedirect } from './redirect'
import type { NotFoundError } from './not-found'
import type { ParsedLocation } from './location'
import type {
  AnyRoute,
  BeforeLoadContextOptions,
  LoaderFnContext,
  SsrContextOptions,
} from './route'
import type { AnyRouteMatch, MakeRouteMatch } from './Matches'
import type { AnyRouter, SSROption, UpdateMatchFn } from './router'

/**
 * An object of this shape is created when calling `loadMatches`.
 * It contains everything we need for all other functions in this file
 * to work. (It's basically the function's argument, plus a few mutable states)
 */
type InnerLoadContext = {
  /** the calling router instance */
  router: AnyRouter
  location: ParsedLocation
  /** mutable state, scoped to a `loadMatches` call */
  firstBadMatchIndex?: number
  /** mutable state, scoped to a `loadMatches` call */
  rendered?: boolean
  serialError?: unknown
  updateMatch: UpdateMatchFn
  matches: Array<AnyRouteMatch>
  preload?: boolean
  forceStaleReload?: boolean
  onReady?: () => Promise<void>
  sync?: boolean
}

const triggerOnReady = (inner: InnerLoadContext): void | Promise<void> => {
  if (!inner.rendered) {
    inner.rendered = true
    return inner.onReady?.()
  }
}

const hasForcePendingActiveMatch = (router: AnyRouter): boolean => {
  return router.stores.matchesId.get().some((matchId) => {
    return router.stores.matchStores.get(matchId)?.get()._forcePending
  })
}

const resolvePreload = (inner: InnerLoadContext, matchId: string): boolean => {
  return !!(inner.preload && !inner.router.stores.matchStores.has(matchId))
}

/**
 * Builds the accumulated context from router options and all matches up to (and optionally including) the given index.
 * Merges __routeContext and __beforeLoadContext from each match.
 */
const buildMatchContext = (
  inner: InnerLoadContext,
  index: number,
  includeCurrentMatch: boolean = true,
): Record<string, unknown> => {
  const context: Record<string, unknown> = {
    ...(inner.router.options.context ?? {}),
  }
  const end = includeCurrentMatch ? index : index - 1
  for (let i = 0; i <= end; i++) {
    const innerMatch = inner.matches[i]
    if (!innerMatch) continue
    const m = inner.router.getMatch(innerMatch.id)
    if (!m) continue
    Object.assign(context, m.__routeContext, m.__beforeLoadContext)
  }
  return context
}

const getNotFoundBoundaryIndex = (
  inner: InnerLoadContext,
  err: NotFoundError,
): number | undefined => {
  if (!inner.matches.length) {
    return undefined
  }

  const requestedRouteId = err.routeId
  const matchedRootIndex = inner.matches.findIndex(
    (m) => m.routeId === inner.router.routeTree.id,
  )
  const rootIndex = matchedRootIndex >= 0 ? matchedRootIndex : 0

  let startIndex = requestedRouteId
    ? inner.matches.findIndex((match) => match.routeId === requestedRouteId)
    : (inner.firstBadMatchIndex ?? inner.matches.length - 1)

  if (startIndex < 0) {
    startIndex = rootIndex
  }

  for (let i = startIndex; i >= 0; i--) {
    const match = inner.matches[i]!
    const route = inner.router.looseRoutesById[match.routeId]!
    if (route.options.notFoundComponent) {
      return i
    }
  }

  // If no boundary component is found, preserve explicit routeId targeting behavior,
  // otherwise default to root for untargeted notFounds.
  return requestedRouteId ? startIndex : rootIndex
}

const handleRedirectAndNotFound = (
  inner: InnerLoadContext,
  match: AnyRouteMatch | undefined,
  err: unknown,
): void => {
  if (!isRedirect(err) && !isNotFound(err)) return

  if (isRedirect(err) && err.redirectHandled && !err.options.reloadDocument) {
    throw err
  }

  // in case of a redirecting match during preload, the match does not exist
  if (match) {
    match._nonReactive.beforeLoadPromise?.resolve()
    match._nonReactive.loaderPromise?.resolve()
    match._nonReactive.beforeLoadPromise = undefined
    match._nonReactive.loaderPromise = undefined

    match._nonReactive.error = err

    inner.updateMatch(match.id, (prev) => ({
      ...prev,
      status: isRedirect(err)
        ? 'redirected'
        : isNotFound(err)
          ? 'notFound'
          : prev.status === 'pending'
            ? 'success'
            : prev.status,
      context: buildMatchContext(inner, match.index),
      isFetching: false,
      error: err,
    }))

    if (isNotFound(err) && !err.routeId) {
      // Stamp the throwing match's routeId so that the finalization step in
      // loadMatches knows where the notFound originated.  The actual boundary
      // resolution (walking up to the nearest notFoundComponent) is deferred to
      // the finalization step, where firstBadMatchIndex is stable and
      // headMaxIndex can be capped correctly.
      err.routeId = match.routeId
    }

    match._nonReactive.loadPromise?.resolve()
  }

  if (isRedirect(err)) {
    inner.rendered = true
    err.options._fromLocation = inner.location
    err.redirectHandled = true
    err = inner.router.resolveRedirect(err)
  }

  throw err
}

const shouldSkipLoader = (
  inner: InnerLoadContext,
  matchId: string,
): boolean => {
  const match = inner.router.getMatch(matchId)
  if (!match) {
    return true
  }
  // upon hydration, we skip the loader if the match has been dehydrated on the server
  if (!(isServer ?? inner.router.isServer) && match._nonReactive.dehydrated) {
    return true
  }

  if ((isServer ?? inner.router.isServer) && match.ssr === false) {
    return true
  }

  return false
}

const syncMatchContext = (
  inner: InnerLoadContext,
  matchId: string,
  index: number,
): void => {
  const nextContext = buildMatchContext(inner, index)

  inner.updateMatch(matchId, (prev) => {
    return {
      ...prev,
      context: nextContext,
    }
  })
}

const handleSerialError = (
  inner: InnerLoadContext,
  index: number,
  err: any,
): void => {
  const { id: matchId, routeId } = inner.matches[index]!
  const route = inner.router.looseRoutesById[routeId]!

  // Much like suspense, we use a promise here to know if
  // we've been outdated by a new loadMatches call and
  // should abort the current async operation
  if (err instanceof Promise) {
    throw err
  }

  inner.firstBadMatchIndex ??= index
  handleRedirectAndNotFound(inner, inner.router.getMatch(matchId), err)

  try {
    route.options.onError?.(err)
  } catch (errorHandlerErr) {
    err = errorHandlerErr
    handleRedirectAndNotFound(inner, inner.router.getMatch(matchId), err)
  }

  inner.updateMatch(matchId, (prev) => {
    prev._nonReactive.beforeLoadPromise?.resolve()
    prev._nonReactive.beforeLoadPromise = undefined
    prev._nonReactive.loadPromise?.resolve()

    return {
      ...prev,
      error: err,
      status: 'error',
      isFetching: false,
      updatedAt: Date.now(),
      abortController: new AbortController(),
    }
  })

  if (!inner.preload && !isRedirect(err) && !isNotFound(err)) {
    inner.serialError ??= err
  }
}

const isBeforeLoadSsr = (
  inner: InnerLoadContext,
  matchId: string,
  index: number,
  route: AnyRoute,
): void | Promise<void> => {
  const existingMatch = inner.router.getMatch(matchId)!
  const parentMatchId = inner.matches[index - 1]?.id
  const parentMatch = parentMatchId
    ? inner.router.getMatch(parentMatchId)!
    : undefined

  // in SPA mode, only SSR the root route
  if (inner.router.isShell()) {
    existingMatch.ssr = route.id === rootRouteId
    return
  }

  if (parentMatch?.ssr === false) {
    existingMatch.ssr = false
    return
  }

  const parentOverride = (tempSsr: SSROption) => {
    if (tempSsr === true && parentMatch?.ssr === 'data-only') {
      return 'data-only'
    }
    return tempSsr
  }

  const defaultSsr = inner.router.options.defaultSsr ?? true

  if (route.options.ssr === undefined) {
    existingMatch.ssr = parentOverride(defaultSsr)
    return
  }

  if (typeof route.options.ssr !== 'function') {
    existingMatch.ssr = parentOverride(route.options.ssr)
    return
  }
  const { search, params } = existingMatch

  const ssrFnContext: SsrContextOptions<any, any, any> = {
    search: makeMaybe(search, existingMatch.searchError),
    params: makeMaybe(params, existingMatch.paramsError),
    location: inner.location,
    matches: inner.matches.map((match) => ({
      index: match.index,
      pathname: match.pathname,
      fullPath: match.fullPath,
      staticData: match.staticData,
      id: match.id,
      routeId: match.routeId,
      search: makeMaybe(match.search, match.searchError),
      params: makeMaybe(match.params, match.paramsError),
      ssr: match.ssr,
    })),
  }

  const tempSsr = route.options.ssr(ssrFnContext)
  if (isPromise(tempSsr)) {
    return tempSsr.then((ssr) => {
      existingMatch.ssr = parentOverride(ssr ?? defaultSsr)
    })
  }

  existingMatch.ssr = parentOverride(tempSsr ?? defaultSsr)
  return
}

const setupPendingTimeout = (
  inner: InnerLoadContext,
  matchId: string,
  route: AnyRoute,
  match: AnyRouteMatch,
): void => {
  if (match._nonReactive.pendingTimeout !== undefined) return

  const pendingMs =
    route.options.pendingMs ?? inner.router.options.defaultPendingMs
  const shouldPending = !!(
    inner.onReady &&
    !(isServer ?? inner.router.isServer) &&
    !resolvePreload(inner, matchId) &&
    (route.options.loader ||
      route.options.beforeLoad ||
      routeNeedsPreload(route)) &&
    typeof pendingMs === 'number' &&
    pendingMs !== Infinity &&
    (route.options.pendingComponent ??
      (inner.router.options as any)?.defaultPendingComponent)
  )

  if (shouldPending) {
    const pendingTimeout = setTimeout(() => {
      // Update the match and prematurely resolve the loadMatches promise so that
      // the pending component can start rendering
      triggerOnReady(inner)
    }, pendingMs)
    match._nonReactive.pendingTimeout = pendingTimeout
  }
}

const preBeforeLoadSetup = (
  inner: InnerLoadContext,
  matchId: string,
  route: AnyRoute,
): void | Promise<void> => {
  const existingMatch = inner.router.getMatch(matchId)!

  // If we are in the middle of a load, either of these will be present
  // (not to be confused with `loadPromise`, which is always defined)
  if (
    !existingMatch._nonReactive.beforeLoadPromise &&
    !existingMatch._nonReactive.loaderPromise
  )
    return

  setupPendingTimeout(inner, matchId, route, existingMatch)

  const then = () => {
    const match = inner.router.getMatch(matchId)!
    if (
      match.preload &&
      (match.status === 'redirected' || match.status === 'notFound')
    ) {
      handleRedirectAndNotFound(inner, match, match.error)
    }
  }

  // Wait for the previous beforeLoad to resolve before we continue
  return existingMatch._nonReactive.beforeLoadPromise
    ? existingMatch._nonReactive.beforeLoadPromise.then(then)
    : then()
}

const executeBeforeLoad = (
  inner: InnerLoadContext,
  matchId: string,
  index: number,
  route: AnyRoute,
): void | Promise<void> => {
  const match = inner.router.getMatch(matchId)!

  // explicitly capture the previous loadPromise
  let prevLoadPromise = match._nonReactive.loadPromise
  match._nonReactive.loadPromise = createControlledPromise<void>(() => {
    prevLoadPromise?.resolve()
    prevLoadPromise = undefined
  })

  const { paramsError, searchError } = match

  if (paramsError) {
    handleSerialError(inner, index, paramsError)
  }

  if (searchError) {
    handleSerialError(inner, index, searchError)
  }

  setupPendingTimeout(inner, matchId, route, match)

  const abortController = new AbortController()

  let isPending = false
  const pending = () => {
    if (isPending) return
    isPending = true
    inner.updateMatch(matchId, (prev) => ({
      ...prev,
      isFetching: 'beforeLoad',
      fetchCount: prev.fetchCount + 1,
      abortController,
      // Note: We intentionally don't update context here.
      // Context should only be updated after beforeLoad resolves to avoid
      // components seeing incomplete context during async beforeLoad execution.
    }))
  }

  const resolve = () => {
    match._nonReactive.beforeLoadPromise?.resolve()
    match._nonReactive.beforeLoadPromise = undefined
    inner.updateMatch(matchId, (prev) => ({
      ...prev,
      isFetching: false,
    }))
  }

  // if there is no `beforeLoad` option, just mark as pending and resolve
  // Context will be updated later in loadRouteMatch after loader completes
  if (!route.options.beforeLoad) {
    inner.router.batch(() => {
      pending()
      resolve()
    })
    return
  }

  match._nonReactive.beforeLoadPromise = createControlledPromise<void>()

  // Build context from all parent matches, excluding current match's __beforeLoadContext
  // (since we're about to execute beforeLoad for this match)
  const context = {
    ...buildMatchContext(inner, index, false),
    ...match.__routeContext,
  }
  const { search, params, cause } = match
  const preload = resolvePreload(inner, matchId)
  const beforeLoadFnContext: BeforeLoadContextOptions<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  > = {
    search,
    abortController,
    params,
    preload,
    context,
    location: inner.location,
    navigate: (opts: any) =>
      inner.router.navigate({
        ...opts,
        _fromLocation: inner.location,
      }),
    buildLocation: inner.router.buildLocation,
    cause: preload ? 'preload' : cause,
    matches: inner.matches,
    routeId: route.id,
    ...inner.router.options.additionalContext,
  }

  const updateContext = (beforeLoadContext: any) => {
    if (beforeLoadContext === undefined) {
      inner.router.batch(() => {
        pending()
        resolve()
      })
      return
    }
    if (isRedirect(beforeLoadContext) || isNotFound(beforeLoadContext)) {
      pending()
      handleSerialError(inner, index, beforeLoadContext)
    }

    inner.router.batch(() => {
      pending()
      inner.updateMatch(matchId, (prev) => ({
        ...prev,
        __beforeLoadContext: beforeLoadContext,
      }))
      resolve()
    })
  }

  let beforeLoadContext
  try {
    beforeLoadContext = route.options.beforeLoad(beforeLoadFnContext)
    if (isPromise(beforeLoadContext)) {
      pending()
      return beforeLoadContext
        .catch((err) => {
          handleSerialError(inner, index, err)
        })
        .then(updateContext)
    }
  } catch (err) {
    pending()
    handleSerialError(inner, index, err)
  }

  updateContext(beforeLoadContext)
  return
}

const handleBeforeLoad = (
  inner: InnerLoadContext,
  index: number,
): void | Promise<void> => {
  const { id: matchId, routeId } = inner.matches[index]!
  const route = inner.router.looseRoutesById[routeId]!

  const serverSsr = () => {
    // on the server, determine whether SSR the current match or not
    if (isServer ?? inner.router.isServer) {
      const maybePromise = isBeforeLoadSsr(inner, matchId, index, route)
      if (isPromise(maybePromise)) return maybePromise.then(queueExecution)
    }
    return queueExecution()
  }

  const execute = () => executeBeforeLoad(inner, matchId, index, route)

  const queueExecution = () => {
    if (shouldSkipLoader(inner, matchId)) return
    const result = preBeforeLoadSetup(inner, matchId, route)
    return isPromise(result) ? result.then(execute) : execute()
  }

  return serverSsr()
}

const executeHead = (
  inner: InnerLoadContext,
  matchId: string,
  route: AnyRoute,
): void | Promise<
  Pick<
    AnyRouteMatch,
    'meta' | 'links' | 'headScripts' | 'headers' | 'scripts' | 'styles'
  >
> => {
  const match = inner.router.getMatch(matchId)
  // in case of a redirecting match during preload, the match does not exist
  if (!match) {
    return
  }
  if (!route.options.head && !route.options.scripts && !route.options.headers) {
    return
  }
  const assetContext = {
    ssr: inner.router.options.ssr,
    matches: inner.matches,
    match,
    params: match.params,
    loaderData: match.loaderData,
  }

  return Promise.all([
    route.options.head?.(assetContext),
    route.options.scripts?.(assetContext),
    route.options.headers?.(assetContext),
  ]).then(([headFnContent, scripts, headers]) => {
    const meta = headFnContent?.meta
    const links = headFnContent?.links
    const headScripts = headFnContent?.scripts
    const styles = headFnContent?.styles

    return {
      meta,
      links,
      headScripts,
      headers,
      scripts,
      styles,
    }
  })
}

const getLoaderContext = (
  inner: InnerLoadContext,
  matchPromises: Array<Promise<AnyRouteMatch>>,
  matchId: string,
  index: number,
  route: AnyRoute,
): LoaderFnContext => {
  const parentMatchPromise = matchPromises[index - 1] as any
  const { params, loaderDeps, abortController, cause } =
    inner.router.getMatch(matchId)!

  const context = buildMatchContext(inner, index)

  const preload = resolvePreload(inner, matchId)

  return {
    params,
    deps: loaderDeps,
    preload: !!preload,
    parentMatchPromise,
    abortController,
    context,
    location: inner.location,
    navigate: (opts) =>
      inner.router.navigate({
        ...opts,
        _fromLocation: inner.location,
      }),
    cause: preload ? 'preload' : cause,
    route,
    ...inner.router.options.additionalContext,
  }
}

const runLoader = async (
  inner: InnerLoadContext,
  matchPromises: Array<Promise<AnyRouteMatch>>,
  matchId: string,
  index: number,
  route: AnyRoute,
): Promise<void> => {
  try {
    // If the Matches component rendered
    // the pending component and needs to show it for
    // a minimum duration, we''ll wait for it to resolve
    // before committing to the match and resolving
    // the loadPromise

    const match = inner.router.getMatch(matchId)!

    // Actually run the loader and handle the result
    try {
      if (!(isServer ?? inner.router.isServer) || match.ssr === true) {
        loadRouteChunk(route)
      }

      // Kick off the loader!
      const routeLoader = route.options.loader
      const loader =
        typeof routeLoader === 'function' ? routeLoader : routeLoader?.handler
      const loaderResult = loader?.(
        getLoaderContext(inner, matchPromises, matchId, index, route),
      )
      const loaderResultIsPromise = !!loader && isPromise(loaderResult)

      const willLoadSomething = !!(
        loaderResultIsPromise ||
        route._lazyPromise ||
        route._componentsPromise ||
        route.options.head ||
        route.options.scripts ||
        route.options.headers ||
        match._nonReactive.minPendingPromise
      )

      if (willLoadSomething) {
        inner.updateMatch(matchId, (prev) => ({
          ...prev,
          isFetching: 'loader',
        }))
      }

      if (loader) {
        const loaderData = loaderResultIsPromise
          ? await loaderResult
          : loaderResult

        handleRedirectAndNotFound(
          inner,
          inner.router.getMatch(matchId),
          loaderData,
        )
        if (loaderData !== undefined) {
          inner.updateMatch(matchId, (prev) => ({
            ...prev,
            loaderData,
          }))
        }
      }

      // Lazy option can modify the route options,
      // so we need to wait for it to resolve before
      // we can use the options
      if (route._lazyPromise) await route._lazyPromise
      const pendingPromise = match._nonReactive.minPendingPromise
      if (pendingPromise) await pendingPromise

      // Last but not least, wait for the components
      // to be preloaded before we resolve the match
      if (route._componentsPromise) await route._componentsPromise
      inner.updateMatch(matchId, (prev) => ({
        ...prev,
        error: undefined,
        context: buildMatchContext(inner, index),
        status: 'success',
        isFetching: false,
        updatedAt: Date.now(),
      }))
    } catch (e) {
      let error = e

      if ((error as any)?.name === 'AbortError') {
        if (match.abortController.signal.aborted) {
          match._nonReactive.loaderPromise?.resolve()
          match._nonReactive.loaderPromise = undefined
          return
        }
        inner.updateMatch(matchId, (prev) => ({
          ...prev,
          status: prev.status === 'pending' ? 'success' : prev.status,
          isFetching: false,
          context: buildMatchContext(inner, index),
        }))
        return
      }

      const pendingPromise = match._nonReactive.minPendingPromise
      if (pendingPromise) await pendingPromise

      if (isNotFound(e)) {
        await (route.options.notFoundComponent as any)?.preload?.()
      }

      handleRedirectAndNotFound(inner, inner.router.getMatch(matchId), e)

      try {
        route.options.onError?.(e)
      } catch (onErrorError) {
        error = onErrorError
        handleRedirectAndNotFound(
          inner,
          inner.router.getMatch(matchId),
          onErrorError,
        )
      }
      if (!isRedirect(error) && !isNotFound(error)) {
        await loadRouteChunk(route, ['errorComponent'])
      }

      inner.updateMatch(matchId, (prev) => ({
        ...prev,
        error,
        context: buildMatchContext(inner, index),
        status: 'error',
        isFetching: false,
      }))
    }
  } catch (err) {
    const match = inner.router.getMatch(matchId)
    // in case of a redirecting match during preload, the match does not exist
    if (match) {
      match._nonReactive.loaderPromise = undefined
    }
    handleRedirectAndNotFound(inner, match, err)
  }
}

const loadRouteMatch = async (
  inner: InnerLoadContext,
  matchPromises: Array<Promise<AnyRouteMatch>>,
  index: number,
): Promise<AnyRouteMatch> => {
  async function handleLoader(
    preload: boolean,
    prevMatch: AnyRouteMatch,
    previousRouteMatchId: string | undefined,
    match: AnyRouteMatch,
    route: AnyRoute,
  ) {
    const age = Date.now() - prevMatch.updatedAt

    const staleAge = preload
      ? (route.options.preloadStaleTime ??
        inner.router.options.defaultPreloadStaleTime ??
        30_000) // 30 seconds for preloads by default
      : (route.options.staleTime ?? inner.router.options.defaultStaleTime ?? 0)

    const shouldReloadOption = route.options.shouldReload

    // Default to reloading the route all the time
    // Allow shouldReload to get the last say,
    // if provided.
    const shouldReload =
      typeof shouldReloadOption === 'function'
        ? shouldReloadOption(
            getLoaderContext(inner, matchPromises, matchId, index, route),
          )
        : shouldReloadOption

    // If the route is successful and still fresh, just resolve
    const { status, invalid } = match
    const staleMatchShouldReload =
      age >= staleAge &&
      (!!inner.forceStaleReload ||
        match.cause === 'enter' ||
        (previousRouteMatchId !== undefined &&
          previousRouteMatchId !== match.id))
    loaderShouldRunAsync =
      status === 'success' &&
      (invalid || (shouldReload ?? staleMatchShouldReload))
    if (preload && route.options.preload === false) {
      // Do nothing
    } else if (
      loaderShouldRunAsync &&
      !inner.sync &&
      shouldReloadInBackground
    ) {
      loaderIsRunningAsync = true
      ;(async () => {
        try {
          await runLoader(inner, matchPromises, matchId, index, route)
          const match = inner.router.getMatch(matchId)!
          match._nonReactive.loaderPromise?.resolve()
          match._nonReactive.loadPromise?.resolve()
          match._nonReactive.loaderPromise = undefined
          match._nonReactive.loadPromise = undefined
        } catch (err) {
          if (isRedirect(err)) {
            await inner.router.navigate(err.options)
          }
        }
      })()
    } else if (status !== 'success' || loaderShouldRunAsync) {
      await runLoader(inner, matchPromises, matchId, index, route)
    } else {
      syncMatchContext(inner, matchId, index)
    }
  }

  const { id: matchId, routeId } = inner.matches[index]!
  let loaderShouldRunAsync = false
  let loaderIsRunningAsync = false
  const route = inner.router.looseRoutesById[routeId]!
  const routeLoader = route.options.loader
  const shouldReloadInBackground =
    ((typeof routeLoader === 'function'
      ? undefined
      : routeLoader?.staleReloadMode) ??
      inner.router.options.defaultStaleReloadMode) !== 'blocking'

  if (shouldSkipLoader(inner, matchId)) {
    const match = inner.router.getMatch(matchId)
    if (!match) {
      return inner.matches[index]!
    }

    syncMatchContext(inner, matchId, index)

    if (isServer ?? inner.router.isServer) {
      return inner.router.getMatch(matchId)!
    }
  } else {
    const prevMatch = inner.router.getMatch(matchId)! // This is where all of the stale-while-revalidate magic happens
    const activeIdAtIndex = inner.router.stores.matchesId.get()[index]
    const activeAtIndex =
      (activeIdAtIndex &&
        inner.router.stores.matchStores.get(activeIdAtIndex)) ||
      null
    const previousRouteMatchId =
      activeAtIndex?.routeId === routeId
        ? activeIdAtIndex
        : inner.router.stores.matches.get().find((d) => d.routeId === routeId)
            ?.id
    const preload = resolvePreload(inner, matchId)

    // there is a loaderPromise, so we are in the middle of a load
    if (prevMatch._nonReactive.loaderPromise) {
      // do not block if we already have stale data we can show
      // but only if the ongoing load is not a preload since error handling is different for preloads
      // and we don't want to swallow errors
      if (
        prevMatch.status === 'success' &&
        !inner.sync &&
        !prevMatch.preload &&
        shouldReloadInBackground
      ) {
        return prevMatch
      }
      await prevMatch._nonReactive.loaderPromise
      const match = inner.router.getMatch(matchId)!
      const error = match._nonReactive.error || match.error
      if (error) {
        handleRedirectAndNotFound(inner, match, error)
      }

      if (match.status === 'pending') {
        await handleLoader(
          preload,
          prevMatch,
          previousRouteMatchId,
          match,
          route,
        )
      }
    } else {
      const nextPreload =
        preload && !inner.router.stores.matchStores.has(matchId)
      const match = inner.router.getMatch(matchId)!
      match._nonReactive.loaderPromise = createControlledPromise<void>()
      if (nextPreload !== match.preload) {
        inner.updateMatch(matchId, (prev) => ({
          ...prev,
          preload: nextPreload,
        }))
      }

      await handleLoader(preload, prevMatch, previousRouteMatchId, match, route)
    }
  }
  const match = inner.router.getMatch(matchId)!
  if (!loaderIsRunningAsync) {
    match._nonReactive.loaderPromise?.resolve()
    match._nonReactive.loadPromise?.resolve()
    match._nonReactive.loadPromise = undefined
  }

  clearTimeout(match._nonReactive.pendingTimeout)
  match._nonReactive.pendingTimeout = undefined
  if (!loaderIsRunningAsync) match._nonReactive.loaderPromise = undefined
  match._nonReactive.dehydrated = undefined

  const nextIsFetching = loaderIsRunningAsync ? match.isFetching : false
  if (nextIsFetching !== match.isFetching || match.invalid !== false) {
    inner.updateMatch(matchId, (prev) => ({
      ...prev,
      isFetching: nextIsFetching,
      invalid: false,
    }))
    return inner.router.getMatch(matchId)!
  } else {
    return match
  }
}

export async function loadMatches(arg: {
  router: AnyRouter
  location: ParsedLocation
  matches: Array<AnyRouteMatch>
  preload?: boolean
  forceStaleReload?: boolean
  onReady?: () => Promise<void>
  updateMatch: UpdateMatchFn
  sync?: boolean
}): Promise<Array<MakeRouteMatch>> {
  const inner: InnerLoadContext = arg
  const matchPromises: Array<Promise<AnyRouteMatch>> = []

  // make sure the pending component is immediately rendered when hydrating a match that is not SSRed
  // the pending component was already rendered on the server and we want to keep it shown on the client until minPendingMs is reached
  if (
    !(isServer ?? inner.router.isServer) &&
    hasForcePendingActiveMatch(inner.router)
  ) {
    triggerOnReady(inner)
  }

  let beforeLoadNotFound: NotFoundError | undefined

  // Execute all beforeLoads one by one
  for (let i = 0; i < inner.matches.length; i++) {
    try {
      const beforeLoad = handleBeforeLoad(inner, i)
      if (isPromise(beforeLoad)) await beforeLoad
    } catch (err) {
      if (isRedirect(err)) {
        throw err
      }
      if (isNotFound(err)) {
        beforeLoadNotFound = err
      } else {
        if (!inner.preload) throw err
      }
      break
    }

    if (inner.serialError || inner.firstBadMatchIndex != null) {
      break
    }
  }

  // Execute loaders once, with max index adapted for beforeLoad notFound handling.
  const baseMaxIndexExclusive = inner.firstBadMatchIndex ?? inner.matches.length

  const boundaryIndex =
    beforeLoadNotFound && !inner.preload
      ? getNotFoundBoundaryIndex(inner, beforeLoadNotFound)
      : undefined

  const maxIndexExclusive =
    beforeLoadNotFound && inner.preload
      ? 0
      : boundaryIndex !== undefined
        ? Math.min(boundaryIndex + 1, baseMaxIndexExclusive)
        : baseMaxIndexExclusive

  let firstNotFound: NotFoundError | undefined
  let firstUnhandledRejection: unknown

  for (let i = 0; i < maxIndexExclusive; i++) {
    matchPromises.push(loadRouteMatch(inner, matchPromises, i))
  }

  try {
    await Promise.all(matchPromises)
  } catch {
    const settled = await Promise.allSettled(matchPromises)

    for (const result of settled) {
      if (result.status !== 'rejected') continue

      const reason = result.reason
      if (isRedirect(reason)) {
        throw reason
      }
      if (isNotFound(reason)) {
        firstNotFound ??= reason
      } else {
        firstUnhandledRejection ??= reason
      }
    }

    if (firstUnhandledRejection !== undefined) {
      throw firstUnhandledRejection
    }
  }

  const notFoundToThrow =
    firstNotFound ??
    (beforeLoadNotFound && !inner.preload ? beforeLoadNotFound : undefined)

  let headMaxIndex =
    inner.firstBadMatchIndex !== undefined
      ? inner.firstBadMatchIndex
      : inner.matches.length - 1

  if (!notFoundToThrow && beforeLoadNotFound && inner.preload) {
    return inner.matches
  }

  if (notFoundToThrow) {
    // Determine once which matched route will actually render the
    // notFoundComponent, then pass this precomputed index through the remaining
    // finalization steps.
    // This can differ from the throwing route when routeId targets an ancestor
    // boundary (or when bubbling resolves to a parent/root boundary).
    const renderedBoundaryIndex = getNotFoundBoundaryIndex(
      inner,
      notFoundToThrow,
    )

    if (renderedBoundaryIndex === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          'Invariant failed: Could not find match for notFound boundary',
        )
      }

      invariant()
    }
    const boundaryMatch = inner.matches[renderedBoundaryIndex]!

    const boundaryRoute = inner.router.looseRoutesById[boundaryMatch.routeId]!
    const defaultNotFoundComponent = (inner.router.options as any)
      ?.defaultNotFoundComponent

    // Ensure a notFoundComponent exists on the boundary route
    if (!boundaryRoute.options.notFoundComponent && defaultNotFoundComponent) {
      boundaryRoute.options.notFoundComponent = defaultNotFoundComponent
    }

    notFoundToThrow.routeId = boundaryMatch.routeId

    const boundaryIsRoot = boundaryMatch.routeId === inner.router.routeTree.id

    inner.updateMatch(boundaryMatch.id, (prev) => ({
      ...prev,
      ...(boundaryIsRoot
        ? // For root boundary, use globalNotFound so the root component's
          // shell still renders and <Outlet> handles the not-found display,
          // instead of replacing the entire root shell via status='notFound'.
          { status: 'success' as const, globalNotFound: true, error: undefined }
        : // For non-root boundaries, set status:'notFound' so MatchInner
          // renders the notFoundComponent directly.
          { status: 'notFound' as const, error: notFoundToThrow }),
      isFetching: false,
    }))

    headMaxIndex = renderedBoundaryIndex

    // Ensure the rendering boundary route chunk (and its lazy components, including
    // lazy notFoundComponent) is loaded before we continue to head execution/render.
    await loadRouteChunk(boundaryRoute, ['notFoundComponent'])
  } else if (!inner.preload) {
    // Clear stale root global-not-found state on normal navigations that do not
    // throw notFound. This must live here (instead of only in runLoader success)
    // because the root loader may be skipped when data is still fresh.
    const rootMatch = inner.matches[0]!
    // `rootMatch` is the next match for this navigation. If it is not global
    // not-found, then any currently stored root global-not-found is stale.
    if (!rootMatch.globalNotFound) {
      // `currentRootMatch` is the current store state (from the previous
      // navigation/load). Update only when a stale flag is actually present.
      const currentRootMatch = inner.router.getMatch(rootMatch.id)
      if (currentRootMatch?.globalNotFound) {
        inner.updateMatch(rootMatch.id, (prev) => ({
          ...prev,
          globalNotFound: false,
          error: undefined,
        }))
      }
    }
  }

  // When a serial error occurred (e.g. beforeLoad threw a regular Error),
  // the erroring route's lazy chunk wasn't loaded because loaders were skipped.
  // We need to load it so the code-split errorComponent is available for rendering.
  if (inner.serialError && inner.firstBadMatchIndex !== undefined) {
    const errorRoute =
      inner.router.looseRoutesById[
        inner.matches[inner.firstBadMatchIndex]!.routeId
      ]!
    await loadRouteChunk(errorRoute, ['errorComponent'])
  }

  // serially execute heads once after loaders/notFound handling, ensuring
  // all head functions get a chance even if one throws.
  for (let i = 0; i <= headMaxIndex; i++) {
    const match = inner.matches[i]!
    const { id: matchId, routeId } = match
    const route = inner.router.looseRoutesById[routeId]!
    try {
      const headResult = executeHead(inner, matchId, route)
      if (headResult) {
        const head = await headResult
        inner.updateMatch(matchId, (prev) => ({
          ...prev,
          ...head,
        }))
      }
    } catch (err) {
      console.error(`Error executing head for route ${routeId}:`, err)
    }
  }

  const readyPromise = triggerOnReady(inner)
  if (isPromise(readyPromise)) {
    await readyPromise
  }

  if (notFoundToThrow) {
    throw notFoundToThrow
  }

  if (inner.serialError && !inner.preload && !inner.onReady) {
    throw inner.serialError
  }

  return inner.matches
}

export type RouteComponentType =
  | 'component'
  | 'errorComponent'
  | 'pendingComponent'
  | 'notFoundComponent'

function preloadRouteComponents(
  route: AnyRoute,
  componentTypesToLoad: Array<RouteComponentType>,
): Promise<void> | undefined {
  const preloads = componentTypesToLoad
    .map((type) => (route.options[type] as any)?.preload?.())
    .filter(Boolean)

  if (preloads.length === 0) return undefined

  return Promise.all(preloads) as any as Promise<void>
}

export function loadRouteChunk(
  route: AnyRoute,
  componentTypesToLoad: Array<RouteComponentType> = componentTypes,
) {
  if (!route._lazyLoaded && route._lazyPromise === undefined) {
    if (route.lazyFn) {
      route._lazyPromise = route.lazyFn().then((lazyRoute) => {
        // explicitly don't copy over the lazy route's id
        const { id: _id, ...options } = lazyRoute.options
        Object.assign(route.options, options)
        route._lazyLoaded = true
        route._lazyPromise = undefined // gc promise, we won't need it anymore
      })
    } else {
      route._lazyLoaded = true
    }
  }

  const runAfterLazy = () =>
    route._componentsLoaded
      ? undefined
      : componentTypesToLoad === componentTypes
        ? (() => {
            if (route._componentsPromise === undefined) {
              const componentsPromise = preloadRouteComponents(
                route,
                componentTypes,
              )

              if (componentsPromise) {
                route._componentsPromise = componentsPromise.then(() => {
                  route._componentsLoaded = true
                  route._componentsPromise = undefined // gc promise, we won't need it anymore
                })
              } else {
                route._componentsLoaded = true
              }
            }

            return route._componentsPromise
          })()
        : preloadRouteComponents(route, componentTypesToLoad)

  return route._lazyPromise
    ? route._lazyPromise.then(runAfterLazy)
    : runAfterLazy()
}

function makeMaybe<TValue, TError>(
  value: TValue,
  error: TError,
): { status: 'success'; value: TValue } | { status: 'error'; error: TError } {
  if (error) {
    return { status: 'error' as const, error }
  }
  return { status: 'success' as const, value }
}

export function routeNeedsPreload(route: AnyRoute) {
  for (const componentType of componentTypes) {
    if ((route.options[componentType] as any)?.preload) {
      return true
    }
  }
  return false
}

export const componentTypes: Array<RouteComponentType> = [
  'component',
  'errorComponent',
  'pendingComponent',
  'notFoundComponent',
] as const
