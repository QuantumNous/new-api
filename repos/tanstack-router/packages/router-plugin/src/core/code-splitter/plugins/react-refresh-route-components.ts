import * as t from '@babel/types'
import {
  getObjectPropertyKeyName,
  getUniqueProgramIdentifier,
} from '../../utils'
import type { ReferenceRouteCompilerPlugin } from '../plugins'

const REACT_REFRESH_ROUTE_COMPONENT_IDENTS = new Set([
  'component',
  'shellComponent',
  'pendingComponent',
  'errorComponent',
  'notFoundComponent',
])

function hoistInlineRouteComponents(ctx: {
  programPath: Parameters<typeof getUniqueProgramIdentifier>[0]
  insertionPath: { insertBefore: (nodes: Array<t.VariableDeclaration>) => void }
  routeOptions: t.ObjectExpression
}) {
  const hoistedDeclarations: Array<t.VariableDeclaration> = []

  ctx.routeOptions.properties.forEach((prop) => {
    if (!t.isObjectProperty(prop)) {
      return
    }

    const key = getObjectPropertyKeyName(prop)

    if (!key || !REACT_REFRESH_ROUTE_COMPONENT_IDENTS.has(key)) {
      return
    }

    if (
      !t.isArrowFunctionExpression(prop.value) &&
      !t.isFunctionExpression(prop.value)
    ) {
      return
    }

    const hoistedIdentifier = getUniqueProgramIdentifier(
      ctx.programPath,
      `TSR${key[0]!.toUpperCase()}${key.slice(1)}`,
    )

    hoistedDeclarations.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(hoistedIdentifier, t.cloneNode(prop.value, true)),
      ]),
    )

    prop.value = t.cloneNode(hoistedIdentifier)
  })

  if (hoistedDeclarations.length === 0) {
    return false
  }

  ctx.insertionPath.insertBefore(hoistedDeclarations)
  return true
}

export function createReactRefreshRouteComponentsPlugin(): ReferenceRouteCompilerPlugin {
  return {
    name: 'react-refresh-route-components',
    getStableRouteOptionKeys() {
      return [...REACT_REFRESH_ROUTE_COMPONENT_IDENTS]
    },
    onUnsplittableRoute(ctx) {
      if (!ctx.opts.addHmr) {
        return
      }

      if (hoistInlineRouteComponents(ctx)) {
        return { modified: true }
      }

      return
    },
    onAddHmr(ctx) {
      if (!ctx.opts.addHmr) {
        return
      }

      if (hoistInlineRouteComponents(ctx)) {
        return { modified: true }
      }

      return
    },
  }
}
