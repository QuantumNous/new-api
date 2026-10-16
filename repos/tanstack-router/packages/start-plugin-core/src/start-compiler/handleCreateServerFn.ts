import * as t from '@babel/types'
import babel from '@babel/core'
import { hasKeys } from '@tanstack/router-core'
import { getVariableDeclaratorForExpressionPath } from '@tanstack/router-utils'
import path from 'pathe'
import { cleanId, codeFrameError, stripMethodCall } from './utils'
import type {
  CompilationContext,
  MethodCallInfo,
  RewriteCandidate,
  ServerFn,
} from './types'
import type { CompileStartFrameworkOptions } from '../types'

const TSS_SERVERFN_SPLIT_PARAM = 'tss-serverfn-split'

const providerHmrAcceptTemplate = babel.template.statements(
  `
if (import.meta.hot) {
  import.meta.hot.accept(() => {})
}
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept(() => {})
}
`,
  {
    placeholderPattern: false,
  },
)

// ============================================================================
// Pre-compiled babel templates (compiled once at module load time)
// ============================================================================

// Template for provider files: createServerRpc(serverFnMeta, fn)
const serverRpcTemplate = babel.template.expression(
  `createServerRpc(%%serverFnMeta%%, %%fn%%)`,
)

// Template for client caller files: createClientRpc(functionId)
const clientRpcTemplate = babel.template.expression(
  `createClientRpc(%%functionId%%)`,
)

// Template for SSR caller files: createSsrRpc(functionId)
const ssrRpcManifestTemplate = babel.template.expression(
  `createSsrRpc(%%functionId%%)`,
)

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
    `${location}createServerFn().inputValidator() is deprecated. Use createServerFn().validator() instead.`,
  )
}

// ============================================================================
// Runtime code cache (cached per framework to avoid repeated AST generation)
// ============================================================================

type RuntimeCodeType = 'provider' | 'client' | 'ssr'
type FrameworkRuntimeCache = Record<RuntimeCodeType, t.Statement>
const RuntimeCodeCache = new Map<
  CompileStartFrameworkOptions,
  FrameworkRuntimeCache
>()

function getCachedRuntimeCode(
  framework: CompileStartFrameworkOptions,
  type: RuntimeCodeType,
): t.Statement {
  let cache = RuntimeCodeCache.get(framework)
  if (!cache) {
    cache = {
      provider: babel.template.ast(
        `import { createServerRpc } from '@tanstack/${framework}-start/server-rpc'`,
        { placeholderPattern: false },
      ) as t.Statement,
      client: babel.template.ast(
        `import { createClientRpc } from '@tanstack/${framework}-start/client-rpc'`,
        { placeholderPattern: false },
      ) as t.Statement,
      ssr: babel.template.ast(
        `import { createSsrRpc } from '@tanstack/${framework}-start/ssr-rpc'`,
        { placeholderPattern: false },
      ) as t.Statement,
    }
    RuntimeCodeCache.set(framework, cache)
  }
  return cache[type]
}

/**
 * Environment-specific configuration for server function transformation.
 * This is computed internally based on the compilation context.
 */
interface EnvConfig {
  /** Whether this environment is a client environment */
  isClientEnvironment: boolean
  /** The runtime code type to use for imports */
  runtimeCodeType: RuntimeCodeType
}

/**
 * Gets the environment configuration for the current compilation context.
 */
function getEnvConfig(
  context: CompilationContext,
  isProviderFile: boolean,
): EnvConfig {
  const { env } = context

  if (isProviderFile) {
    return {
      isClientEnvironment: false,
      runtimeCodeType: 'provider',
    }
  }

  if (env === 'client') {
    return {
      isClientEnvironment: true,
      runtimeCodeType: 'client',
    }
  }

  // Server caller (SSR)
  return {
    isClientEnvironment: false,
    runtimeCodeType: 'ssr',
  }
}

/**
 * Builds the serverFnMeta object literal AST node.
 * The object contains: { id, name, filename }
 */
function buildServerFnMetaObject(
  functionId: string,
  variableName: string,
  filename: string,
): t.ObjectExpression {
  return t.objectExpression([
    t.objectProperty(t.identifier('id'), t.stringLiteral(functionId)),
    t.objectProperty(t.identifier('name'), t.stringLiteral(variableName)),
    t.objectProperty(t.identifier('filename'), t.stringLiteral(filename)),
  ])
}

/**
 * Generates the RPC stub expression for provider files.
 * Uses pre-compiled template for performance.
 */
function generateProviderRpcStub(
  serverFnMeta: t.ObjectExpression,
  fn: t.Expression,
): t.Expression {
  return serverRpcTemplate({
    serverFnMeta,
    fn,
  })
}

/**
 * Generates the RPC stub expression for caller files.
 * Uses pre-compiled templates for performance.
 * Note: Client and SSR callers only receive the functionId string, not the full metadata.
 */
function generateCallerRpcStub(
  functionId: string,
  envConfig: EnvConfig,
): t.Expression {
  const functionIdLiteral = t.stringLiteral(functionId)

  if (envConfig.runtimeCodeType === 'client') {
    return clientRpcTemplate({
      functionId: functionIdLiteral,
    })
  }

  return ssrRpcManifestTemplate({
    functionId: functionIdLiteral,
  })
}

/**
 * Handles createServerFn transformations for a batch of candidates.
 *
 * This function performs extraction and replacement of server functions
 *
 * For caller files (non-provider):
 * - Replaces the server function with an RPC stub
 * - Does not include the handler function body
 *
 * For provider files:
 * - Creates an extractedFn that calls __executeServer
 * - Modifies .handler() to pass (extractedFn, serverFn) - two arguments
 *
 * @param candidates - All ServerFn candidates to process
 * @param context - The compilation context with helpers and mutable state
 * @returns Result containing runtime code to add, or null if no candidates processed
 */
export function handleCreateServerFn(
  candidates: Array<RewriteCandidate>,
  context: CompilationContext,
) {
  if (candidates.length === 0) {
    return
  }

  const isProviderFile = context.id.includes(TSS_SERVERFN_SPLIT_PARAM)
  if (isProviderFile && context.serverFnProviderModuleDirectives) {
    ensureDirectivePrologue(
      context.ast,
      context.serverFnProviderModuleDirectives,
    )
  }

  // Get environment-specific configuration
  const envConfig = getEnvConfig(context, isProviderFile)

  // Track function names to ensure uniqueness within this file
  const functionNameSet = new Set<string>()

  const exportNames = new Set<string>()
  const serverFnsById: Record<string, ServerFn> = {}

  const [baseFilename] = context.id.split('?') as [string]
  const extractedFilename = `${baseFilename}?${TSS_SERVERFN_SPLIT_PARAM}`
  const relativeFilename = path.relative(context.root, baseFilename)
  const knownFns = context.getKnownServerFns()
  const cleanedContextId = cleanId(context.id)

  for (const candidate of candidates) {
    const { path: candidatePath, methodChain } = candidate
    const { validator, inputValidator, handler } = methodChain

    const candidateVariableDeclarator = getVariableDeclaratorForExpressionPath(
      candidatePath as babel.NodePath<t.Expression>,
    )

    // Check if the call is assigned to a variable
    if (!candidateVariableDeclarator) {
      throw new Error('createServerFn must be assigned to a variable!')
    }

    // Get the identifier name of the variable
    const variableDeclarator = candidateVariableDeclarator.node
    if (!t.isIdentifier(variableDeclarator.id)) {
      throw codeFrameError(
        context.code,
        variableDeclarator.id.loc!,
        'createServerFn must be assigned to a simple identifier, not a destructuring pattern',
      )
    }
    const existingVariableName = variableDeclarator.id.name

    // Generate unique function name with _createServerFn_handler suffix
    // The function name is derived from the variable name
    let functionName = `${existingVariableName}_createServerFn_handler`
    while (functionNameSet.has(functionName)) {
      functionName = incrementFunctionNameVersion(functionName)
    }
    functionNameSet.add(functionName)

    // Generate function ID using pre-computed relative filename
    const functionId = context.generateFunctionId({
      filename: relativeFilename,
      functionName,
      extractedFilename,
    })

    // Check if this function was already discovered by the client build
    const knownFn = knownFns[functionId]
    // A server function is client-referenced when:
    // 1. We're in the client (browser) environment, OR
    // 2. It was already discovered by another environment (knownFn), OR
    // 3. We're in an SSR caller environment — any server function reachable from
    //    SSR module graph is callable via client navigation HTTP requests
    const isClientReferenced =
      envConfig.isClientEnvironment ||
      !!knownFn ||
      envConfig.runtimeCodeType === 'ssr'

    // Use canonical extracted filename from known functions if available
    const canonicalExtractedFilename =
      knownFn?.extractedFilename ?? extractedFilename

    // TODO remove upon stable
    if (inputValidator) {
      warnInputValidatorDeprecation(context, inputValidator)
    }

    // Handle validators - remove on client
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
          `createServerFn().${methodName}() must be called with a validator!`,
        )
      }

      // If we're on the client, remove the validator call expression
      if (context.env === 'client') {
        stripMethodCall(methodCall.callPath)
      }
    }

    const handlerFnPath = handler?.firstArgPath

    if (!handler || !handlerFnPath?.node) {
      throw codeFrameError(
        context.code,
        candidatePath.node.callee.loc!,
        `createServerFn must be called with a "handler" property!`,
      )
    }

    // Validate the handler argument is an expression (not a SpreadElement, etc.)
    if (!t.isExpression(handlerFnPath.node)) {
      throw codeFrameError(
        context.code,
        handlerFnPath.node.loc!,
        `handler() must be called with an expression, not a ${handlerFnPath.node.type}`,
      )
    }

    const handlerFn = handlerFnPath.node

    // Register function only from caller files (not provider files)
    // to avoid duplicates - provider files process the same functions

    if (!isProviderFile) {
      serverFnsById[functionId] = {
        functionName,
        functionId,
        filename: cleanedContextId,
        extractedFilename: canonicalExtractedFilename,
        isClientReferenced,
      }
    }

    if (isProviderFile) {
      // PROVIDER FILE: This is the extracted file that contains the actual implementation
      // We need to:
      // 1. Create an extractedFn that calls __executeServer
      // 2. Modify .handler() to pass (extractedFn, serverFn) - two arguments
      //
      // Expected output format:
      // const extractedFn = createServerRpc({id, name, filename}, (opts) => varName.__executeServer(opts));
      // const varName = createServerFn().handler(extractedFn, originalHandler);

      // Build the arrow function: (opts) => varName.__executeServer(opts)
      // The signal parameter is passed through to allow abort signal propagation
      const executeServerArrowFn = t.arrowFunctionExpression(
        [t.identifier('opts')],
        t.callExpression(
          t.memberExpression(
            t.identifier(existingVariableName),
            t.identifier('__executeServer'),
          ),
          [t.identifier('opts')],
        ),
      )

      // Build the serverFnMeta object
      const serverFnMeta = buildServerFnMetaObject(
        functionId,
        existingVariableName,
        relativeFilename,
      )

      // Generate the replacement using pre-compiled template
      const extractedFnInit = generateProviderRpcStub(
        serverFnMeta,
        executeServerArrowFn,
      )

      // Build the extracted function statement
      const extractedFnStatement = t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(functionName), extractedFnInit),
      ])

      // Find the variable declaration statement containing our createServerFn
      const variableDeclaration = candidateVariableDeclarator.parentPath
      if (!variableDeclaration.isVariableDeclaration()) {
        throw new Error(
          'Expected createServerFn to be in a VariableDeclaration',
        )
      }

      // Insert the extracted function statement before the variable declaration
      variableDeclaration.insertBefore(extractedFnStatement)

      // Modify the .handler() call to pass two arguments: (extractedFn, serverFn)
      // The handlerFnPath.node contains the original serverFn
      const extractedFnIdentifier = t.identifier(functionName)
      const serverFnNode = t.cloneNode(handlerFn, true)

      // Replace handler's arguments with [extractedFn, serverFn]
      handler.callPath.node.arguments = [extractedFnIdentifier, serverFnNode]

      // Only export the extracted handler (e.g., myFn_createServerFn_handler)
      // The manifest and all import paths only look up this suffixed name.
      // The original variable (e.g., myFn) stays in the file but is not exported
      // since it's only used internally.
      exportNames.add(functionName)
    } else {
      // CALLER FILE: This file calls the server function but doesn't contain the implementation
      // We need to:
      // 1. Remove the handler function body (it will be in the provider file)
      // 2. Replace the handler argument with an RPC stub
      //
      // IMPORTANT: We must keep the createServerFn().handler(extractedFn) structure
      // so that the client middleware chain can unwrap the {result, error, context} response.
      //
      // Expected output format:
      // const myFn = createServerFn().handler(createClientRpc("id"))
      // or
      // const myFn = createServerFn().handler(createSsrRpc("id"))

      // Generate the RPC stub using pre-compiled templates
      // Note: Caller files only pass functionId, not the full serverFnMeta
      const rpcStub = generateCallerRpcStub(functionId, envConfig)

      // Replace ONLY the handler argument with the RPC stub
      // Keep the createServerFn().handler() wrapper intact for client middleware
      handlerFnPath.replaceWith(rpcStub)
    }
  }

  // For provider files, add exports for all extracted functions
  if (isProviderFile) {
    // Remove all existing exports first
    safeRemoveExports(context.ast)

    // Export all server function related variables from exportNames
    // These were populated by handleCreateServerFn:
    // 1. Extracted handlers: const fn_createServerFn_handler = createServerRpc(...)
    // 2. Original variables: const fn = createServerFn().handler(...)
    if (exportNames.size > 0) {
      context.ast.program.body.push(
        t.exportNamedDeclaration(
          undefined,
          Array.from(exportNames).map((name) =>
            t.exportSpecifier(t.identifier(name), t.identifier(name)),
          ),
        ),
      )
    }

    if (context.mode === 'dev') {
      context.ast.program.body.push(...providerHmrAcceptTemplate())
    }
  }

  // Notify about discovered functions (only for non-provider files)
  if (!isProviderFile && hasKeys(serverFnsById) && context.onServerFnsById) {
    context.onServerFnsById(serverFnsById)
  }

  // Add runtime import using cached AST node
  const runtimeCode = getCachedRuntimeCode(
    context.framework,
    envConfig.runtimeCodeType,
  )
  context.ast.program.body.unshift(t.cloneNode(runtimeCode))
}

/**
 * Makes an identifier safe for use as a JavaScript identifier.
 */
function makeIdentifierSafe(identifier: string): string {
  return identifier
    .replace(/[^a-zA-Z0-9_$]/g, '_') // Replace unsafe chars with underscore
    .replace(/^[0-9]/, '_$&') // Prefix leading number with underscore
    .replace(/^\$/, '_$') // Prefix leading $ with underscore
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
}

/**
 * Increments the version number suffix on a function name.
 */
function incrementFunctionNameVersion(functionName: string): string {
  const [realReferenceName, count] = functionName.split(/_(\d+)$/)
  const resolvedCount = Number(count || '0')
  const suffix = `_${resolvedCount + 1}`
  return makeIdentifierSafe(realReferenceName!) + suffix
}

/**
 * Removes all exports from the AST while preserving the declarations.
 * Used for provider files where we want to re-export only the server functions.
 */
function safeRemoveExports(ast: t.File): void {
  ast.program.body = ast.program.body.flatMap((node) => {
    if (
      t.isExportNamedDeclaration(node) ||
      t.isExportDefaultDeclaration(node)
    ) {
      if (
        t.isFunctionDeclaration(node.declaration) ||
        t.isClassDeclaration(node.declaration) ||
        t.isVariableDeclaration(node.declaration)
      ) {
        // do not remove export if it is an anonymous function / class,
        // otherwise this would produce a syntax error
        if (
          t.isFunctionDeclaration(node.declaration) ||
          t.isClassDeclaration(node.declaration)
        ) {
          if (!node.declaration.id) {
            return node
          }
        }
        return node.declaration
      } else if (node.declaration === null) {
        // remove e.g. `export { RouteComponent as component }`
        return []
      }
    }
    return node
  })
}

function ensureDirectivePrologue(
  ast: t.File,
  directiveValues: ReadonlyArray<string>,
): void {
  const directives = ast.program.directives
  const existingDirectives = new Set(
    directives.map((directive) => directive.value.value),
  )
  const missingDirectives: Array<string> = []

  for (const directiveValue of directiveValues) {
    if (!directiveValue || existingDirectives.has(directiveValue)) continue

    existingDirectives.add(directiveValue)
    missingDirectives.push(directiveValue)
  }

  for (let i = missingDirectives.length - 1; i >= 0; i--) {
    directives.unshift(t.directive(t.directiveLiteral(missingDirectives[i]!)))
  }
}
