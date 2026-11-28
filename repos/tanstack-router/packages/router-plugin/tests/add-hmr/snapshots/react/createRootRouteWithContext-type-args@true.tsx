import * as React from 'react';
import { createRootRouteWithContext } from '@tanstack/react-router';
interface MyRouterContext {
  auth: boolean;
}
export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent
});
function RootComponent() {
  return <div>Hello</div>;
}
const hot = import.meta.hot;
if (hot && typeof window !== 'undefined') {
  hot.data ??= {};
  const tsrReactRefresh = window.__TSR_REACT_REFRESH__ ??= (() => {
    const ignoredExportsById = new Map();
    const previousGetIgnoredExports = window.__getReactRefreshIgnoredExports;
    window.__getReactRefreshIgnoredExports = ctx => {
      const ignoredExports = previousGetIgnoredExports?.(ctx) ?? [];
      const moduleIgnored = ignoredExportsById.get(ctx.id) ?? [];
      return [...ignoredExports, ...moduleIgnored];
    };
    return {
      ignoredExportsById
    };
  })();
  tsrReactRefresh.ignoredExportsById.set("createRootRouteWithContext-type-args.tsx", ['Route']);
}
export function TSRFastRefreshAnchor() {
  return null;
}
if (import.meta.hot) {
  const hot = import.meta.hot;
  const hotData = hot.data ??= {};
  const handleRouteUpdate = function handleRouteUpdate(routeId, newRoute) {
    const router = window.__TSR_ROUTER__;
    const oldRoute = router.routesById[routeId];
    if (!oldRoute) {
      return;
    }
    ;
    const generatedRouteOptionKeys = new Set(["id", "path", "getParentRoute"]);
    const generatedRouteOptions = {};
    generatedRouteOptionKeys.forEach(key => {
      if (key in oldRoute.options) {
        generatedRouteOptions[key] = oldRoute.options[key];
      }
    });
    const removedKeys = new Set();
    Object.keys(oldRoute.options).forEach(key => {
      if (!generatedRouteOptionKeys.has(key) && !(key in newRoute.options)) {
        removedKeys.add(key);
        delete oldRoute.options[key];
      }
    });
    const oldHasShellComponent = "shellComponent" in oldRoute.options;
    const newHasShellComponent = "shellComponent" in newRoute.options;
    const preserveComponentIdentity = oldHasShellComponent === newHasShellComponent;
    const componentKeys = ["component", "shellComponent", "pendingComponent", "errorComponent", "notFoundComponent"];
    if (preserveComponentIdentity) {
      componentKeys.forEach(key => {
        if (key in oldRoute.options && key in newRoute.options) {
          newRoute.options[key] = oldRoute.options[key];
        }
      });
    }
    ;
    const nextOptions = {
      ...newRoute.options,
      ...generatedRouteOptions
    };
    oldRoute.options = nextOptions;
    oldRoute.update(nextOptions);
    oldRoute._componentsPromise = undefined;
    oldRoute._lazyPromise = undefined;
    router.setRoutes(router.buildRouteTree());
    syncHotRouteExport(oldRoute);
    router.resolvePathCache.clear();
    const filter = m => m.routeId === oldRoute.id;
    const activeMatch = router.stores.matches.get().find(filter);
    const pendingMatch = router.stores.pendingMatches.get().find(filter);
    const cachedMatches = router.stores.cachedMatches.get().filter(filter);
    if (activeMatch || pendingMatch || cachedMatches.length > 0) {
      if (removedKeys.has("loader") || removedKeys.has("beforeLoad")) {
        const matchIds = [activeMatch?.id, pendingMatch?.id, ...cachedMatches.map(match => match.id)].filter(Boolean);
        router.batch(() => {
          for (const matchId of matchIds) {
            const store = router.stores.pendingMatchStores.get(matchId) || router.stores.matchStores.get(matchId) || router.stores.cachedMatchStores.get(matchId);
            if (store) {
              store.set(prev => {
                const next = {
                  ...prev
                };
                if (removedKeys.has("loader")) {
                  next.loaderData = undefined;
                }
                ;
                if (removedKeys.has("beforeLoad")) {
                  next.__beforeLoadContext = undefined;
                  next.context = rebuildMatchContextWithoutBeforeLoad(next);
                }
                ;
                return next;
              });
            }
          }
        });
      }
      ;
      router.invalidate({
        filter,
        sync: true
      });
    }
    ;
    function syncHotRouteExport(liveRoute) {
      newRoute.options = liveRoute.options;
      newRoute.parentRoute = liveRoute.parentRoute;
      newRoute._path = liveRoute._path;
      newRoute._id = liveRoute._id;
      newRoute._fullPath = liveRoute._fullPath;
      newRoute._to = liveRoute._to;
    }
    function getStoreMatch(matchId) {
      return router.stores.pendingMatchStores.get(matchId)?.get() || router.stores.matchStores.get(matchId)?.get() || router.stores.cachedMatchStores.get(matchId)?.get();
    }
    function getMatchList(matchId) {
      const pendingMatches = router.stores.pendingMatches.get();
      if (pendingMatches.some(match => match.id === matchId)) {
        return pendingMatches;
      }
      ;
      const activeMatches = router.stores.matches.get();
      if (activeMatches.some(match => match.id === matchId)) {
        return activeMatches;
      }
      ;
      const cachedMatches = router.stores.cachedMatches.get();
      if (cachedMatches.some(match => match.id === matchId)) {
        return cachedMatches;
      }
      ;
      return [];
    }
    function getParentMatch(match) {
      const matchList = getMatchList(match.id);
      const matchIndex = matchList.findIndex(item => item.id === match.id);
      if (matchIndex <= 0) {
        return undefined;
      }
      ;
      const parentMatch = matchList[matchIndex - 1];
      return getStoreMatch(parentMatch.id) || parentMatch;
    }
    function rebuildMatchContextWithoutBeforeLoad(match) {
      const parentMatch = getParentMatch(match);
      const getParentContext = router.getParentContext;
      const parentContext = getParentContext ? getParentContext.call(router, parentMatch) : parentMatch?.context ?? router.options.context;
      return {
        ...(parentContext ?? {}),
        ...(match.__routeContext ?? {})
      };
    }
  };
  const initialRouteId = Route.id ?? hotData['tsr-route-id'];
  if (initialRouteId) {
    hotData['tsr-route-id'] = initialRouteId;
  }
  const existingRoute = typeof window !== 'undefined' && initialRouteId ? window.__TSR_ROUTER__?.routesById?.[initialRouteId] : undefined;
  if (initialRouteId && existingRoute && existingRoute !== Route) {
    handleRouteUpdate(initialRouteId, Route);
    hotData['tsr-route-update-handled'] = Route;
  }
  hot.accept(newModule => {
    if (Route && newModule && newModule.Route) {
      const routeId = hotData['tsr-route-id'] ?? Route.id;
      if (routeId) {
        hotData['tsr-route-id'] = routeId;
      }
      if (hotData['tsr-route-update-handled'] === newModule.Route) {
        delete hotData['tsr-route-update-handled'];
        return;
      }
      handleRouteUpdate(routeId, newModule.Route);
    }
  });
}