import * as template from '@babel/template'
import * as t from '@babel/types'
import { getUniqueProgramIdentifier } from '../../utils'
import type { ReferenceRouteCompilerPlugin } from '../plugins'

const buildReactRefreshIgnoredRouteExportsStatements = template.statements(
  `
const hot = import.meta.hot
if (hot && typeof window !== 'undefined') {
  hot.data ??= {}
  const tsrReactRefresh = window.__TSR_REACT_REFRESH__ ??= (() => {
    const ignoredExportsById = new Map()
    const previousGetIgnoredExports = window.__getReactRefreshIgnoredExports

    window.__getReactRefreshIgnoredExports = (ctx) => {
      const ignoredExports = previousGetIgnoredExports?.(ctx) ?? []
      const moduleIgnored = ignoredExportsById.get(ctx.id) ?? []
      return [...ignoredExports, ...moduleIgnored]
    }

    return {
      ignoredExportsById,
    }
  })()

  tsrReactRefresh.ignoredExportsById.set(%%moduleId%%, ['Route'])
}
`,
  { syntacticPlaceholders: true },
)

/**
 * A trivial component-shaped export that gives `@vitejs/plugin-react` a valid
 * Fast Refresh boundary. Without at least one non-ignored component export,
 * the module would be invalidated (full page reload) on every update even
 * though our custom route HMR handler already manages the update.
 */
const buildRefreshAnchorStatement = template.statement(
  `export function %%anchorName%%() { return null }`,
  { syntacticPlaceholders: true },
)

export function createReactRefreshIgnoredRouteExportsPlugin(): ReferenceRouteCompilerPlugin {
  return {
    name: 'react-refresh-ignored-route-exports',
    onAddHmr(ctx) {
      const anchorName = getUniqueProgramIdentifier(
        ctx.programPath,
        'TSRFastRefreshAnchor',
      )

      ctx.programPath.pushContainer(
        'body',
        buildReactRefreshIgnoredRouteExportsStatements({
          moduleId: t.stringLiteral(ctx.opts.id),
        }),
      )

      ctx.programPath.pushContainer(
        'body',
        buildRefreshAnchorStatement({ anchorName }),
      )

      return { modified: true }
    },
  }
}
