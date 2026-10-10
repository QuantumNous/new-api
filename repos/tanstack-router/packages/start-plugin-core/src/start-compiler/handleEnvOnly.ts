import * as t from '@babel/types'
import type { CompilationContext, RewriteCandidate } from './types'
import type { LookupKind } from './compiler'

function capitalize(str: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Handles serverOnly/clientOnly function transformations for a batch of candidates.
 *
 * @param candidates - All EnvOnly candidates to process (all same kind)
 * @param context - The compilation context
 * @param kind - The specific kind (ServerOnlyFn or ClientOnlyFn)
 */
export function handleEnvOnlyFn(
  candidates: Array<RewriteCandidate>,
  context: CompilationContext,
  kind: LookupKind,
): void {
  const targetEnv = kind === 'ClientOnlyFn' ? 'client' : 'server'

  for (const candidate of candidates) {
    const { path } = candidate

    if (context.env === targetEnv) {
      // Matching environment - extract the inner function
      const innerFn = path.node.arguments[0]

      if (!t.isExpression(innerFn)) {
        throw new Error(
          `create${capitalize(targetEnv)}OnlyFn() must be called with a function!`,
        )
      }

      path.replaceWith(innerFn)
    } else {
      // Wrong environment - replace with a function that throws an error
      path.replaceWith(
        t.arrowFunctionExpression(
          [],
          t.blockStatement([
            t.throwStatement(
              t.newExpression(t.identifier('Error'), [
                t.stringLiteral(
                  `create${capitalize(targetEnv)}OnlyFn() functions can only be called on the ${targetEnv}!`,
                ),
              ]),
            ),
          ]),
        ),
      )
    }
  }
}
