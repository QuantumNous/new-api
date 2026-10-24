import * as template from '@babel/template'
import { getHandleRouteUpdateCode } from './handle-route-update'
import type { Config } from '../config'
import type * as t from '@babel/types'

/**
 * Emits HMR accept code for bundlers with webpack-compatible `module.hot`
 * semantics (classic webpack via `import.meta.webpackHot`, and Rspack).
 *
 * Unlike Vite's `hot.accept((newModule) => {...})` — where the callback receives
 * the freshly re-imported module — webpack re-executes the module factory on
 * accept, so our HMR logic must live at module top level and read the previous
 * `routeId` out of `hot.data`. `hot.dispose` stashes it for the next run, and
 * `hot.accept()` (no callback) enrolls us as a self-accepting boundary.
 *
 * Returns an array of statements that patches route definitions during HMR.
 */
export function createWebpackHmrStatement(
  stableRouteOptionKeys: Array<string>,
  opts: {
    targetFramework: Config['target']
    routeId?: string
  },
): Array<t.Statement> {
  const handleRouteUpdateCode = getHandleRouteUpdateCode(stableRouteOptionKeys)
  const staticRouteIdLiteral =
    typeof opts.routeId === 'string'
      ? JSON.stringify(opts.routeId)
      : 'undefined'

  // React-only: route modules aren't React Refresh "boundaries" (they export
  // a non-component `Route`), so the bundler's react-refresh runtime won't
  // call `performReactRefresh` for us. We kick it manually after swapping
  // route options so newly-registered component bodies get patched into live
  // fibers.
  //
  // Webpack and Rspack refresh plugins inject `__react_refresh_utils__` via
  // ProvidePlugin. Use it when present instead of importing
  // `react-refresh/runtime`, because Rsbuild apps may use React without the
  // React plugin and therefore may not have that optional dependency installed.
  //
  // Use the same delayed refresh style as Rspack's React Refresh runtime.
  // Route modules and their split component chunks can arrive in separate HMR
  // steps under CI load; a microtask can run before the split chunk registers
  // its new component family, causing the refresh to no-op or remount.
  //
  // For non-React frameworks we skip this entirely.
  const reactRefreshCall =
    opts.targetFramework === 'react'
      ? `
    try {
      const tsrReactRefreshUtils =
        typeof __react_refresh_utils__ !== 'undefined'
          ? __react_refresh_utils__
          : undefined
      const tsrEnqueueUpdate =
        tsrReactRefreshUtils && typeof tsrReactRefreshUtils.enqueueUpdate === 'function'
          ? tsrReactRefreshUtils.enqueueUpdate
          : undefined
      if (tsrEnqueueUpdate) {
        tsrEnqueueUpdate(() => {})
      }
    } catch (_err) { /* noop */ }`
      : ''

  return [
    template.statement(
      `
if (import.meta.webpackHot) {
  const hot = import.meta.webpackHot
  const hotData = hot.data ??= {}
  const routeId = hotData['tsr-route-id'] ?? Route.id ?? (Route.isRoot ? '__root__' : ${staticRouteIdLiteral})
  if (routeId) {
    hotData['tsr-route-id'] = routeId
  }
  const existingRoute =
    typeof window !== 'undefined' && routeId
      ? window.__TSR_ROUTER__?.routesById?.[routeId]
      : undefined
  if (routeId && existingRoute && existingRoute !== Route) {
    (${handleRouteUpdateCode})(routeId, Route)${reactRefreshCall}
  }
  hot.dispose((data) => {
    if (routeId) {
      data['tsr-route-id'] = routeId
    }
  })
  hot.accept()
}
`,
      {
        syntacticPlaceholders: true,
      },
    )(),
  ]
}
