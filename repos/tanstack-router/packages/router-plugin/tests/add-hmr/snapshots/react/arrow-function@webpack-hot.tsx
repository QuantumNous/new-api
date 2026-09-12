const $$splitComponentImporter = () => import('arrow-function.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { fetchPosts } from '../posts';
const TSRSplitComponent = (() => {
  const hot = import.meta.webpackHot;
  const hotData = hot ? hot.data ??= {} : undefined;
  return hotData?.["tsr-split-component:component"] ?? lazyRouteComponent($$splitComponentImporter, "component");
})();
if (import.meta.webpackHot) {
  (import.meta.webpackHot.data ??= {})["tsr-split-component:component"] = TSRSplitComponent;
}
export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: TSRSplitComponent
});
if (import.meta.webpackHot) {
  const hot = import.meta.webpackHot;
  const hotData = hot.data ??= {};
  const routeId = hotData['tsr-route-id'] ?? Route.id ?? (Route.isRoot ? '__root__' : undefined);
  if (routeId) {
    hotData['tsr-route-id'] = routeId;
  }
  const existingRoute = typeof window !== 'undefined' && routeId ? window.__TSR_ROUTER__?.routesById?.[routeId] : undefined;
  if (routeId && existingRoute && existingRoute !== Route) {
    (function handleRouteUpdate(routeId, newRoute) {
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
    })(routeId, Route);
    try {
      const tsrReactRefreshUtils = typeof __react_refresh_utils__ !== 'undefined' ? __react_refresh_utils__ : undefined;
      const tsrEnqueueUpdate = tsrReactRefreshUtils && typeof tsrReactRefreshUtils.enqueueUpdate === 'function' ? tsrReactRefreshUtils.enqueueUpdate : undefined;
      if (tsrEnqueueUpdate) {
        tsrEnqueueUpdate(() => {});
      }
    } catch (_err) {}
  }
  hot.dispose(data => {
    if (routeId) {
      data['tsr-route-id'] = routeId;
    }
  });
  hot.accept();
}