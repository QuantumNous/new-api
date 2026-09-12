import { stripMethodCall } from './utils'
import type {
  CompilationContext,
  MethodCallInfo,
  RewriteCandidate,
} from './types'

// TODO remove upon stable
function warnInputValidatorDeprecation(
  context: CompilationContext,
  inputValidator: MethodCallInfo,
): void {
  const loc = inputValidator.callPath.node.loc?.start
  const location = loc
    ? `${context.id}:${loc.line}:${loc.column + 1} `
    : `${context.id} `

  context.warn?.(
    `${location}createMiddleware().inputValidator() is deprecated. Use createMiddleware().validator() instead.`,
  )
}

/**
 * Handles createMiddleware transformations for a batch of candidates.
 *
 * @param candidates - All Middleware candidates to process
 * @param context - The compilation context
 */
export function handleCreateMiddleware(
  candidates: Array<RewriteCandidate>,
  context: CompilationContext,
): void {
  if (context.env === 'server') {
    throw new Error('handleCreateMiddleware should not be called on the server')
  }

  for (const candidate of candidates) {
    const { validator, inputValidator, server } = candidate.methodChain

    // TODO remove upon stable
    if (inputValidator) {
      warnInputValidatorDeprecation(context, inputValidator)
    }

    for (const [methodName, methodCall] of [
      ['validator', validator],
      // TODO remove upon stable
      ['inputValidator', inputValidator],
    ] as const) {
      if (!methodCall) {
        continue
      }

      const innerInputExpression = methodCall.callPath.node.arguments[0]

      if (!innerInputExpression) {
        throw new Error(
          `createMiddleware().${methodName}() must be called with a validator!`,
        )
      }

      // remove the validator call expression
      stripMethodCall(methodCall.callPath)
    }

    if (server) {
      // remove the server call expression
      stripMethodCall(server.callPath)
    }
  }
}
