import type * as babel from '@babel/core'
import type * as t from '@babel/types'
import type { StartCompilerTransformContext } from '../types'

/**
 * Context passed to all plugin handlers during compilation.
 * Contains both read-only input data and mutable state that handlers update.
 */
export interface CompilationContext extends StartCompilerTransformContext {
  /** Generate a unique function ID */
  generateFunctionId: GenerateFunctionIdFn
  /** Get known server functions from previous builds (e.g., client build) */
  getKnownServerFns: () => Record<string, ServerFn>
  /** Module-level directives to add to extracted server function provider files. */
  serverFnProviderModuleDirectives: ReadonlyArray<string> | undefined

  /**
   * Callback when server functions are discovered.
   * Called after each file is compiled with its new functions.
   */
  onServerFnsById: ((d: Record<string, ServerFn>) => void) | undefined
}

/**
 * Batched plugin handler signature.
 * Receives ALL candidates of a specific kind in one call.
 * Mutates the CompilationContext directly.
 */
export type BatchedPluginHandler<TOpts = unknown> = (
  candidates: Array<RewriteCandidate>,
  context: CompilationContext,
  opts: TOpts,
) => void

/**
 * Info about a method call in the chain, including the call expression path
 * and the path to its first argument (if any).
 */
export interface MethodCallInfo {
  callPath: babel.NodePath<t.CallExpression>
  /** Path to the first argument, or null if no arguments */
  firstArgPath: babel.NodePath | null
}

/**
 * Pre-collected method chain paths for a root call expression.
 * This avoids needing to traverse the AST again in handlers.
 */
export interface MethodChainPaths {
  middleware: MethodCallInfo | null
  validator: MethodCallInfo | null
  // TODO remove upon stable
  inputValidator: MethodCallInfo | null
  handler: MethodCallInfo | null
  server: MethodCallInfo | null
  client: MethodCallInfo | null
}

export type MethodChainKey = keyof MethodChainPaths

/**
 * Information about a candidate that needs to be rewritten.
 */
export interface RewriteCandidate {
  path: babel.NodePath<t.CallExpression>
  methodChain: MethodChainPaths
}

/**
 * Represents an extracted server function that has been registered.
 * Used for manifest generation and tracking function metadata.
 */
export interface ServerFn {
  /** The unique name used to export this function */
  functionName: string
  /** The unique ID for this function (used in RPC calls) */
  functionId: string
  /** The filename with query param where the extracted implementation lives */
  extractedFilename: string
  /** The original source filename */
  filename: string
  /**
   * True when this function was discovered by the client build.
   * Used to restrict HTTP access to only client-referenced functions.
   */
  isClientReferenced?: boolean
}

/**
 * Function type for generating unique function IDs.
 */
export type GenerateFunctionIdFn = (opts: {
  filename: string
  functionName: string
  extractedFilename: string
}) => string

/**
 * Optional version that allows returning undefined to use default ID generation.
 */
export type GenerateFunctionIdFnOptional = (
  opts: Omit<Parameters<GenerateFunctionIdFn>[0], 'extractedFilename'>,
) => string | undefined

/**
 * Function type for generating replacement code for server functions.
 * Used internally by handleCreateServerFn.
 */
export type DevServerFnModuleSpecifierEncoder = (opts: {
  extractedFilename: string
  root: string
}) => string

export type ReplacerFn = (opts: {
  /** Placeholder for the original function expression */
  fn: string
  /** The filename where the extracted implementation lives */
  extractedFilename: string
  /** The original source filename */
  filename: string
  /** The unique function ID */
  functionId: string
  /** The export name for this function */
  functionName: string
  /** True if this is the source/provider file (has the implementation) */
  isSourceFn: boolean
  /**
   * True when this function was already discovered by a previous build (e.g., client).
   * For SSR callers, this means the function is in the manifest.
   */
  isClientReferenced: boolean
}) => string
