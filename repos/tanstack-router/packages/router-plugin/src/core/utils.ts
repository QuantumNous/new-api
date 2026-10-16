import * as t from '@babel/types'
import type babel from '@babel/core'

export const debug =
  process.env.TSR_VITE_DEBUG &&
  ['true', 'router-plugin'].includes(process.env.TSR_VITE_DEBUG)

/**
 * Normalizes a file path by converting Windows backslashes to forward slashes.
 * This ensures consistent path handling across different bundlers and operating systems.
 *
 * The route generator stores paths with forward slashes, but rspack/webpack on Windows
 * pass native paths with backslashes to transform handlers.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

export const routeFactoryCallCodeFilter = [
  /\bcreateFileRoute\s*\(/,
  /\bcreateRootRoute\s*\(/,
  /\bcreateRootRouteWithContext\s*(?:<|\()/,
]

export function getObjectPropertyKeyName(
  prop: t.ObjectProperty,
): string | undefined {
  if (prop.computed) {
    return undefined
  }

  if (t.isIdentifier(prop.key)) {
    return prop.key.name
  }

  if (t.isStringLiteral(prop.key)) {
    return prop.key.value
  }

  return undefined
}

export function getUniqueProgramIdentifier(
  programPath: babel.NodePath<t.Program>,
  baseName: string,
): t.Identifier {
  let name = baseName
  let suffix = 2

  const programScope = programPath.scope.getProgramParent()

  while (
    programScope.hasBinding(name) ||
    programScope.hasGlobal(name) ||
    programScope.hasReference(name)
  ) {
    name = `${baseName}${suffix}`
    suffix++
  }

  // Register the name so subsequent calls within the same traversal
  // see it and avoid collisions
  programScope.references[name] = true

  return t.identifier(name)
}
