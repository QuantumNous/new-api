import type {
  AnyRoute,
  AnyRouteMatch,
  AnyRouter,
  RouterWritableStore,
} from '@tanstack/router-core'

type AnyRouteWithPrivateProps = AnyRoute & {
  options: Record<string, unknown>
  parentRoute: AnyRoute
  _componentsPromise?: Promise<void>
  _lazyPromise?: Promise<void>
  update: (options: Record<string, unknown>) => unknown
  _path: string
  _id: string
  _fullPath: string
  _to: string
}

type AnyRouterWithPrivateMaps = AnyRouter & {
  routesById: Record<string, AnyRoute>
  buildRouteTree: () => Parameters<AnyRouter['setRoutes']>[0]
  setRoutes: AnyRouter['setRoutes']
  stores: AnyRouter['stores'] & {
    cachedMatchStores: Map<
      string,
      Pick<RouterWritableStore<AnyRouteMatch>, 'get' | 'set'>
    >
    pendingMatchStores: Map<
      string,
      Pick<RouterWritableStore<AnyRouteMatch>, 'get' | 'set'>
    >
    matchStores: Map<
      string,
      Pick<RouterWritableStore<AnyRouteMatch>, 'get' | 'set'>
    >
  }
}

type AnyRouteMatchWithPrivateProps = AnyRouteMatch & {
  __beforeLoadContext?: unknown
  __routeContext?: Record<string, unknown>
  context?: Record<string, unknown>
}

function handleRouteUpdate(
  routeId: string,
  newRoute: AnyRouteWithPrivateProps,
) {
  const router = window.__TSR_ROUTER__ as AnyRouterWithPrivateMaps
  const oldRoute = router.routesById[routeId] as
    | AnyRouteWithPrivateProps
    | undefined

  if (!oldRoute) {
    return
  }

  // Generated route-tree options are not present on the freshly imported route
  // module, but they must stay on the live route before rebuilding indexes.
  const generatedRouteOptionKeys = new Set(['id', 'path', 'getParentRoute'])
  const generatedRouteOptions: Record<string, unknown> = {}
  generatedRouteOptionKeys.forEach((key) => {
    if (key in oldRoute.options) {
      generatedRouteOptions[key] = oldRoute.options[key]
    }
  })

  const removedKeys = new Set<string>()
  Object.keys(oldRoute.options).forEach((key) => {
    if (!generatedRouteOptionKeys.has(key) && !(key in newRoute.options)) {
      removedKeys.add(key)
      delete oldRoute.options[key]
    }
  })

  const oldHasShellComponent = 'shellComponent' in oldRoute.options
  const newHasShellComponent = 'shellComponent' in newRoute.options
  const preserveComponentIdentity =
    oldHasShellComponent === newHasShellComponent

  // Keys whose identity must remain stable to prevent React from
  // unmounting/remounting the component tree.  React Fast Refresh already
  // handles hot-updating the function bodies of these components — our job
  // is only to update non-component route options (loader, head, etc.).
  // For code-split (splittable) routes, the lazyRouteComponent wrapper is
  // already cached in the bundler hot data so its identity is stable.
  // For unsplittable routes (e.g. root routes), the component is a plain
  // function reference that gets recreated on every module re-execution,
  // so we must explicitly preserve the old reference.
  // Preserve component identity so React doesn't remount.
  // React Fast Refresh patches the function bodies in-place.
  const componentKeys = '__TSR_COMPONENT_TYPES__' as unknown as Array<string>
  if (preserveComponentIdentity) {
    componentKeys.forEach((key) => {
      if (key in oldRoute.options && key in newRoute.options) {
        newRoute.options[key] = oldRoute.options[key]
      }
    })
  }

  const nextOptions = {
    ...newRoute.options,
    ...generatedRouteOptions,
  }

  oldRoute.options = nextOptions
  oldRoute.update(nextOptions)
  oldRoute._componentsPromise = undefined
  oldRoute._lazyPromise = undefined

  router.setRoutes(router.buildRouteTree())
  syncHotRouteExport(oldRoute)
  router.resolvePathCache.clear()

  const filter = (m: AnyRouteMatch) => m.routeId === oldRoute.id
  const activeMatch = router.stores.matches.get().find(filter)
  const pendingMatch = router.stores.pendingMatches.get().find(filter)
  const cachedMatches = router.stores.cachedMatches.get().filter(filter)

  if (activeMatch || pendingMatch || cachedMatches.length > 0) {
    // Clear stale match data for removed route options BEFORE invalidating.
    // Without this, router.invalidate() -> matchRoutes() reuses the existing
    // match from the store (via ...existingMatch spread) and the stale
    // loaderData / __beforeLoadContext survives the reload cycle.
    //
    // We must update the store directly (not via router.updateMatch) because
    // updateMatch wraps in startTransition which may defer the state update,
    // and we need the clear to be visible before invalidate reads the store.
    if (removedKeys.has('loader') || removedKeys.has('beforeLoad')) {
      const matchIds = [
        activeMatch?.id,
        pendingMatch?.id,
        ...cachedMatches.map((match) => match.id),
      ].filter(Boolean) as Array<string>
      router.batch(() => {
        for (const matchId of matchIds) {
          const store =
            router.stores.pendingMatchStores.get(matchId) ||
            router.stores.matchStores.get(matchId) ||
            router.stores.cachedMatchStores.get(matchId)
          if (store) {
            store.set((prev) => {
              const next: AnyRouteMatchWithPrivateProps = { ...prev }

              if (removedKeys.has('loader')) {
                next.loaderData = undefined
              }
              if (removedKeys.has('beforeLoad')) {
                next.__beforeLoadContext = undefined
                next.context = rebuildMatchContextWithoutBeforeLoad(next)
              }

              return next
            })
          }
        }
      })
    }

    router.invalidate({ filter, sync: true })
  }

  function syncHotRouteExport(liveRoute: AnyRouteWithPrivateProps) {
    // routeTree.gen.ts mutates the original module export with generated
    // routing state. Mirror that state onto the fresh HMR export too, so
    // aliased route imports keep working after the module is hot-reloaded.
    newRoute.options = liveRoute.options
    newRoute.parentRoute = liveRoute.parentRoute
    newRoute._path = liveRoute._path
    newRoute._id = liveRoute._id
    newRoute._fullPath = liveRoute._fullPath
    newRoute._to = liveRoute._to
  }

  function getStoreMatch(matchId: string) {
    return (
      router.stores.pendingMatchStores.get(matchId)?.get() ||
      router.stores.matchStores.get(matchId)?.get() ||
      router.stores.cachedMatchStores.get(matchId)?.get()
    )
  }

  function getMatchList(matchId: string) {
    const pendingMatches = router.stores.pendingMatches.get()
    if (pendingMatches.some((match) => match.id === matchId)) {
      return pendingMatches
    }

    const activeMatches = router.stores.matches.get()
    if (activeMatches.some((match) => match.id === matchId)) {
      return activeMatches
    }

    const cachedMatches = router.stores.cachedMatches.get()
    if (cachedMatches.some((match) => match.id === matchId)) {
      return cachedMatches
    }

    return []
  }

  function getParentMatch(match: AnyRouteMatch) {
    const matchList = getMatchList(match.id)
    const matchIndex = matchList.findIndex((item) => item.id === match.id)

    if (matchIndex <= 0) {
      return undefined
    }

    const parentMatch = matchList[matchIndex - 1]!
    return getStoreMatch(parentMatch.id) || parentMatch
  }

  function rebuildMatchContextWithoutBeforeLoad(
    match: AnyRouteMatchWithPrivateProps,
  ) {
    const parentMatch = getParentMatch(match)
    const getParentContext = (
      router as unknown as {
        getParentContext?: (
          parentMatch?: AnyRouteMatch,
        ) => Record<string, unknown> | undefined
      }
    ).getParentContext
    const parentContext = getParentContext
      ? getParentContext.call(router, parentMatch)
      : (parentMatch?.context ?? router.options.context)

    return {
      ...(parentContext ?? {}),
      ...(match.__routeContext ?? {}),
    }
  }
}

const handleRouteUpdateStr = handleRouteUpdate.toString()

export function getHandleRouteUpdateCode(stableRouteOptionKeys: Array<string>) {
  return handleRouteUpdateStr.replace(
    /['"]__TSR_COMPONENT_TYPES__['"]/,
    JSON.stringify(stableRouteOptionKeys),
  )
}
