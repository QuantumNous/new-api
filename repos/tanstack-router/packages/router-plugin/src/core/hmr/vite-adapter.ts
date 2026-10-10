import * as template from '@babel/template'
import { getHandleRouteUpdateCode } from './handle-route-update'
import type * as t from '@babel/types'

/**
 * Emits HMR accept code for Vite / native ESM HMR: `import.meta.hot.accept`
 * with a callback that receives the freshly re-imported module.
 *
 * `targetFramework` is currently unused — Vite's framework-specific fast-refresh
 * plugins handle component body patching via their own accept boundaries — but
 * we take it for API symmetry with `createWebpackHmrStatement`.
 */
export function createViteHmrStatement(
  stableRouteOptionKeys: Array<string>,
  opts: {
    routeId?: string
  } = {},
): Array<t.Statement> {
  const handleRouteUpdateCode = getHandleRouteUpdateCode(stableRouteOptionKeys)
  // The replacement Route object can be uninitialized; keep a generated id as
  // fallback for the existing router route we need to patch.
  const routeIdFallback =
    typeof opts.routeId === 'string' ? JSON.stringify(opts.routeId) : 'Route.id'

  return [
    template.statement(
      `
if (import.meta.hot) {
  const hot = import.meta.hot
  const hotData = hot.data ??= {}
  const handleRouteUpdate = ${handleRouteUpdateCode}
  const initialRouteId = ${routeIdFallback} ?? hotData['tsr-route-id']
  if (initialRouteId) {
    hotData['tsr-route-id'] = initialRouteId
  }
  const existingRoute =
    typeof window !== 'undefined' && initialRouteId
      ? window.__TSR_ROUTER__?.routesById?.[initialRouteId]
      : undefined
  if (initialRouteId && existingRoute && existingRoute !== Route) {
    handleRouteUpdate(initialRouteId, Route)
    hotData['tsr-route-update-handled'] = Route
  }
  hot.accept((newModule) => {
    if (Route && newModule && newModule.Route) {
      const routeId = hotData['tsr-route-id'] ?? ${routeIdFallback}
      if (routeId) {
        hotData['tsr-route-id'] = routeId
      }
      if (hotData['tsr-route-update-handled'] === newModule.Route) {
        delete hotData['tsr-route-update-handled']
        return
      }
      handleRouteUpdate(routeId, newModule.Route)
    }
    })
}
`,
      {
        syntacticPlaceholders: true,
      },
    )(),
  ]
}
