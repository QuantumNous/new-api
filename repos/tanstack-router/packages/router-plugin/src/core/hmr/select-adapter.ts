import { createViteHmrStatement } from './vite-adapter'
import { createWebpackHmrStatement } from './webpack-adapter'
import type { Config, HmrStyle } from '../config'
import type * as t from '@babel/types'

export type CreateRouteHmrStatementOpts = {
  hmrStyle: HmrStyle
  targetFramework: Config['target']
  routeId?: string
}

/**
 * Dispatches to the configured HMR adapter. `hmrStyle` is set explicitly by
 * the bundler-specific plugin entry (e.g. `rspack.ts` → `'webpack'`), so there
 * is no runtime inference based on config string shapes.
 */
export function createRouteHmrStatement(
  stableRouteOptionKeys: Array<string>,
  opts: CreateRouteHmrStatementOpts,
): Array<t.Statement> {
  const routeId = opts.routeId === '/__root' ? '__root__' : opts.routeId

  if (opts.hmrStyle === 'webpack') {
    return createWebpackHmrStatement(stableRouteOptionKeys, {
      targetFramework: opts.targetFramework,
      routeId,
    })
  }
  return createViteHmrStatement(stableRouteOptionKeys, {
    routeId,
  })
}
