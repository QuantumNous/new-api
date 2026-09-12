import crypto from 'node:crypto'
import * as t from '@babel/types'
import {
  deadCodeElimination,
  extractModuleInfoFromAst,
  findReferencedIdentifiers,
  generateFromAst,
  getVariableDeclaratorForExpressionPath,
  parseAst,
  unwrapExpression,
} from '@tanstack/router-utils'
import babel from '@babel/core'
import { handleCreateServerFn } from './handleCreateServerFn'
import { handleCreateMiddleware } from './handleCreateMiddleware'
import { handleCreateIsomorphicFn } from './handleCreateIsomorphicFn'
import { handleEnvOnlyFn } from './handleEnvOnly'
import { handleClientOnlyJSX } from './handleClientOnlyJSX'
import { cleanId } from './utils'
import type {
  CompilationContext,
  DevServerFnModuleSpecifierEncoder,
  MethodChainPaths,
  RewriteCandidate,
  ServerFn,
} from './types'
import type { ModuleInfoBinding } from '@tanstack/router-utils'
import type {
  CompileStartFrameworkOptions,
  StartCompilerEnvironment,
  StartCompilerImportTransform,
  StartCompilerPlugin,
  StartCompilerTransformResult,
} from '../types'

type Binding = ModuleInfoBinding & {
  resolvedKind?: Kind
}

type ImportBinding = Extract<Binding, { type: 'import' }>

type Kind = 'None' | `Root` | `Builder` | LookupKind
type ParsedAst = ReturnType<typeof parseAst>
type StartCompilerAstPlugin = StartCompilerPlugin & {
  transformAst: NonNullable<StartCompilerPlugin['transformAst']>
}

export type BuiltInLookupKind =
  | 'ServerFn'
  | 'Middleware'
  | 'IsomorphicFn'
  | 'ServerOnlyFn'
  | 'ClientOnlyFn'
  | 'ClientOnlyJSX'

export type ExternalLookupKind = `External:${string}`

export type LookupKind = BuiltInLookupKind | ExternalLookupKind

// Detection strategy for each kind
type MethodChainSetup = {
  type: 'methodChain'
  candidateCallIdentifier: Set<string>
}
type DirectCallSetup = {
  type: 'directCall'
  // The factory function name used to create this kind (e.g., 'createServerOnlyFn')
  factoryNames: Set<string>
}
type JSXSetup = { type: 'jsx'; componentName: string }

function isLookupKind(kind: Kind): kind is LookupKind {
  return kind in BuiltInLookupSetup || isExternalLookupKind(kind)
}

export function getExternalLookupKind(
  transform: StartCompilerImportTransform,
): ExternalLookupKind {
  return `External:${transform.name}`
}

function isExternalLookupKind(kind: Kind): kind is ExternalLookupKind {
  return typeof kind === 'string' && kind.startsWith('External:')
}

export function isCompilerTransformEnabledForEnv(
  transform: StartCompilerImportTransform,
  env: StartCompilerEnvironment,
): boolean {
  return isStartCompilerEnvironmentEnabled(transform.environment, env)
}

export function isStartCompilerPluginEnabledForEnv(
  plugin: StartCompilerPlugin,
  env: StartCompilerEnvironment,
): boolean {
  return isStartCompilerEnvironmentEnabled(plugin.environment, env)
}

function isStartCompilerEnvironmentEnabled(
  environment:
    | StartCompilerEnvironment
    | Array<StartCompilerEnvironment>
    | undefined,
  env: StartCompilerEnvironment,
): boolean {
  if (!environment) return true
  if (Array.isArray(environment)) {
    return environment.includes(env)
  }
  return environment === env
}

const BuiltInLookupSetup: Record<
  BuiltInLookupKind,
  MethodChainSetup | DirectCallSetup | JSXSetup
> = {
  ServerFn: {
    type: 'methodChain',
    candidateCallIdentifier: new Set(['handler']),
  },
  Middleware: {
    type: 'methodChain',
    candidateCallIdentifier: new Set(['server', 'client', 'createMiddlewares']),
  },
  IsomorphicFn: {
    type: 'methodChain',
    candidateCallIdentifier: new Set(['server', 'client']),
  },
  ServerOnlyFn: {
    type: 'directCall',
    factoryNames: new Set(['createServerOnlyFn']),
  },
  ClientOnlyFn: {
    type: 'directCall',
    factoryNames: new Set(['createClientOnlyFn']),
  },
  ClientOnlyJSX: { type: 'jsx', componentName: 'ClientOnly' },
}

// Single source of truth for detecting which kinds are present in code
// These patterns are used for:
// 1. Pre-scanning code to determine which kinds to look for (before AST parsing)
// 2. Deriving the plugin's transform code filter
export const KindDetectionPatterns: Record<BuiltInLookupKind, RegExp> = {
  ServerFn: /\bcreateServerFn\b|\.\s*handler\s*\(/,
  Middleware: /createMiddleware/,
  IsomorphicFn: /createIsomorphicFn/,
  ServerOnlyFn: /createServerOnlyFn/,
  ClientOnlyFn: /createClientOnlyFn/,
  ClientOnlyJSX: /<ClientOnly|import\s*\{[^}]*\bClientOnly\b/,
}

// Which kinds are valid for each environment
export const LookupKindsPerEnv: Record<
  'client' | 'server',
  Set<BuiltInLookupKind>
> = {
  client: new Set([
    'Middleware',
    'ServerFn',
    'IsomorphicFn',
    'ServerOnlyFn',
    'ClientOnlyFn',
  ] as const),
  server: new Set([
    'ServerFn',
    'IsomorphicFn',
    'ServerOnlyFn',
    'ClientOnlyFn',
    'ClientOnlyJSX', // Only transform on server to remove children
  ] as const),
}

export function getLookupKindsForEnv(
  env: 'client' | 'server',
  opts?: {
    compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  },
): Set<LookupKind> {
  const kinds: Set<LookupKind> = new Set(LookupKindsPerEnv[env])
  for (const transform of opts?.compilerTransforms ?? []) {
    if (isCompilerTransformEnabledForEnv(transform, env)) {
      kinds.add(getExternalLookupKind(transform))
    }
  }
  return kinds
}

/**
 * Handler type for processing candidates of a specific kind.
 * The kind is passed as the third argument to allow shared handlers (like handleEnvOnlyFn).
 */
type KindHandler = (
  candidates: Array<RewriteCandidate>,
  context: CompilationContext,
  kind: BuiltInLookupKind,
) => void

/**
 * Registry mapping each LookupKind to its handler function.
 * When adding a new kind, add its handler here.
 */
const BuiltInKindHandlers: Record<
  Exclude<BuiltInLookupKind, 'ClientOnlyJSX'>,
  KindHandler
> = {
  ServerFn: handleCreateServerFn,
  Middleware: handleCreateMiddleware,
  IsomorphicFn: handleCreateIsomorphicFn,
  ServerOnlyFn: handleEnvOnlyFn,
  ClientOnlyFn: handleEnvOnlyFn,
  // ClientOnlyJSX is handled separately via JSX traversal, not here
}

const BuiltInKindHandlerOrder: Array<
  Exclude<BuiltInLookupKind, 'ClientOnlyJSX'>
> = ['ServerFn', 'Middleware', 'IsomorphicFn', 'ServerOnlyFn', 'ClientOnlyFn']

// All lookup kinds as an array for iteration with proper typing
const AllBuiltInLookupKinds = Object.keys(
  BuiltInLookupSetup,
) as Array<BuiltInLookupKind>

/**
 * Detects which LookupKinds are present in the code using string matching.
 * This is a fast pre-scan before AST parsing to limit the work done during compilation.
 */
export function detectKindsInCode(
  code: string,
  env: 'client' | 'server',
  opts?: {
    compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  },
): Set<LookupKind> {
  const detected = new Set<LookupKind>()
  const validForEnv = getLookupKindsForEnv(env, opts)

  for (const kind of AllBuiltInLookupKinds) {
    const pattern = KindDetectionPatterns[kind]
    pattern.lastIndex = 0
    if (validForEnv.has(kind) && pattern.test(code)) {
      detected.add(kind)
    }
  }

  for (const transform of opts?.compilerTransforms ?? []) {
    if (!isCompilerTransformEnabledForEnv(transform, env)) continue
    transform.detect.lastIndex = 0
    if (transform.detect.test(code)) {
      detected.add(getExternalLookupKind(transform))
    }
  }

  return detected
}

// Pre-computed map: identifier name -> Set<LookupKind> for fast candidate detection (method chain only)
// Multiple kinds can share the same identifier (e.g., 'server' and 'client' are used by both Middleware and IsomorphicFn)
const IdentifierToKinds = new Map<string, Set<LookupKind>>()
for (const kind of AllBuiltInLookupKinds) {
  const setup = BuiltInLookupSetup[kind]
  if (setup.type === 'methodChain') {
    for (const id of setup.candidateCallIdentifier) {
      let kinds = IdentifierToKinds.get(id)
      if (!kinds) {
        kinds = new Set()
        IdentifierToKinds.set(id, kinds)
      }
      kinds.add(kind)
    }
  }
}

function getLookupSetup(
  kind: LookupKind,
  externalLookupSetup?: Map<ExternalLookupKind, DirectCallSetup>,
): MethodChainSetup | DirectCallSetup | JSXSetup | undefined {
  if (kind in BuiltInLookupSetup) {
    return BuiltInLookupSetup[kind as BuiltInLookupKind]
  }

  if (isExternalLookupKind(kind)) {
    return externalLookupSetup?.get(kind)
  }

  return undefined
}

export type LookupConfig = {
  libName: string
  rootExport: string
  kind: LookupKind | 'Root' // 'Root' for builder pattern, LookupKind for direct call
}

interface ExportResolution {
  moduleInfo: ModuleInfo
  localName: string
  binding: Binding
}

interface ModuleInfo {
  id: string
  bindings: Map<string, Binding>
  // Maps exported name → local binding name
  exports: Map<string, string>
  // Track `export * from './module'` declarations for re-export resolution
  reExportAllSources: Array<string>
}

/**
 * Checks if all kinds in the set are guaranteed to be top-level only.
 * Only ServerFn is always declared at module level (must be assigned to a variable).
 * Middleware, IsomorphicFn, ServerOnlyFn, ClientOnlyFn can be nested inside functions.
 * When all kinds are top-level-only, we can use a fast scan instead of full traversal.
 */
function areAllKindsTopLevelOnly(kinds: Set<LookupKind>): boolean {
  return kinds.size === 1 && kinds.has('ServerFn')
}

/**
 * Checks if we need to detect JSX elements (e.g., <ClientOnly>).
 */
function needsJSXDetection(
  kinds: Set<LookupKind>,
  externalLookupSetup?: Map<ExternalLookupKind, DirectCallSetup>,
): boolean {
  for (const kind of kinds) {
    if (getLookupSetup(kind, externalLookupSetup)?.type === 'jsx') {
      return true
    }
  }
  return false
}

/**
 * Checks if a CallExpression is a direct-call candidate for NESTED detection.
 * Returns true if the callee is a known factory function name.
 * This is stricter than top-level detection because we need to filter out
 * invocations of existing server functions (e.g., `myServerFn()`).
 */
function isNestedDirectCallCandidate(
  node: t.CallExpression,
  lookupKinds: Set<LookupKind>,
  externalLookupSetup?: Map<ExternalLookupKind, DirectCallSetup>,
): boolean {
  let calleeName: string | undefined
  if (t.isIdentifier(node.callee)) {
    calleeName = node.callee.name
  } else if (
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property)
  ) {
    calleeName = node.callee.property.name
  }
  if (!calleeName) return false
  for (const kind of lookupKinds) {
    if (isExternalLookupKind(kind)) continue
    const setup = getLookupSetup(kind, externalLookupSetup)
    if (setup?.type === 'directCall' && setup.factoryNames.has(calleeName)) {
      return true
    }
  }
  return false
}

function isSimpleDirectCallExpression(node: t.CallExpression): boolean {
  return (
    t.isIdentifier(node.callee) ||
    (t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object) &&
      t.isIdentifier(node.callee.property))
  )
}

function isTopLevelDirectCallCandidateNode(node: t.CallExpression): boolean {
  return isSimpleDirectCallExpression(node)
}

function getPotentialCandidateCallExpression(
  node: t.Expression | null | undefined,
): t.CallExpression | null {
  if (!node) {
    return null
  }

  const unwrapped = unwrapExpression(node)
  return t.isCallExpression(unwrapped) ? unwrapped : null
}

/**
 * Checks if a CallExpression path is a top-level direct-call candidate.
 * Top-level means the call is the init of a VariableDeclarator at program level.
 * We accept any simple identifier call or namespace call at top level
 * (e.g., `createServerOnlyFn()`, `TanStackStart.createServerOnlyFn()`) and let
 * resolution verify it. This handles renamed imports.
 */
function isTopLevelDirectCallCandidate(
  path: babel.NodePath<t.CallExpression>,
): boolean {
  const node = path.node

  // Must be a simple identifier call or namespace call
  if (!isSimpleDirectCallExpression(node)) {
    return false
  }

  // Must be top-level: VariableDeclarator -> VariableDeclaration -> Program
  // or VariableDeclarator -> VariableDeclaration -> ExportNamedDeclaration -> Program.
  const variableDeclarator = getVariableDeclaratorForExpressionPath(
    path as babel.NodePath<t.Expression>,
  )
  if (!variableDeclarator) {
    return false
  }

  const variableDeclaration = variableDeclarator.parentPath
  if (!variableDeclaration.isVariableDeclaration()) {
    return false
  }

  const parent = variableDeclaration.parentPath
  return (
    parent.isProgram() ||
    (parent.isExportNamedDeclaration() && parent.parentPath.isProgram())
  )
}

function isDirectCallCandidateForKind(
  kind: Exclude<LookupKind, 'ClientOnlyJSX'>,
  externalLookupSetup?: Map<ExternalLookupKind, DirectCallSetup>,
): boolean {
  return getLookupSetup(kind, externalLookupSetup)?.type === 'directCall'
}

function hasBuiltInDirectCallKinds(kinds: Set<LookupKind>): boolean {
  for (const kind of kinds) {
    if (isExternalLookupKind(kind)) continue
    if (BuiltInLookupSetup[kind].type === 'directCall') return true
  }
  return false
}

function hasExternalLookupKinds(kinds: Set<LookupKind>): boolean {
  for (const kind of kinds) {
    if (isExternalLookupKind(kind)) return true
  }
  return false
}

interface ExternalDirectCallCandidates {
  identifiers: Map<string, ExternalLookupKind>
  namespaces: Map<string, Map<string, ExternalLookupKind>>
}

interface CallExpressionCandidate {
  path: babel.NodePath<t.CallExpression>
  /** Set when import scanning already proved the call's lookup kind. */
  kind?: Exclude<LookupKind, 'ClientOnlyJSX'>
}

function hasExternalDirectCallCandidates(
  candidates: ExternalDirectCallCandidates,
): boolean {
  return candidates.identifiers.size > 0 || candidates.namespaces.size > 0
}

function getExternalDirectCallCandidateKind(
  path: babel.NodePath<t.CallExpression>,
  candidates: ExternalDirectCallCandidates,
): ExternalLookupKind | undefined {
  const node = path.node

  if (t.isIdentifier(node.callee)) {
    const kind = candidates.identifiers.get(node.callee.name)
    if (!kind) return undefined

    const binding = path.scope.getBinding(node.callee.name)
    return binding?.path.isImportSpecifier() ? kind : undefined
  }

  if (
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object) &&
    t.isIdentifier(node.callee.property)
  ) {
    const kind = candidates.namespaces
      .get(node.callee.object.name)
      ?.get(node.callee.property.name)
    if (!kind) return undefined

    const binding = path.scope.getBinding(node.callee.object.name)
    return binding?.path.isImportNamespaceSpecifier() ? kind : undefined
  }

  return undefined
}

export class StartCompiler {
  private moduleCache = new Map<string, ModuleInfo>()
  private initialized = false
  private validLookupKinds: Set<LookupKind>
  private externalTransformsByKind = new Map<
    ExternalLookupKind,
    StartCompilerImportTransform
  >()
  private externalLookupSetup = new Map<ExternalLookupKind, DirectCallSetup>()
  private compilerPlugins: Array<StartCompilerPlugin>
  private externalDirectCallKindsBySource = new Map<
    string,
    Map<string, ExternalLookupKind>
  >()
  private resolveIdCache = new Map<string, string | null>()
  private exportResolutionCache = new Map<
    string,
    Map<string, ExportResolution | null>
  >()
  // Fast lookup for direct imports from known libraries (e.g., '@tanstack/react-start')
  // Maps: libName → (exportName → Kind)
  // This allows O(1) resolution for the common case without async resolveId calls
  private knownRootImports = new Map<string, Map<string, Kind>>()

  // For generating unique function IDs in production builds
  private entryIdToFunctionId = new Map<string, string>()
  private functionIds = new Set<string>()

  constructor(
    private options: {
      env: 'client' | 'server'
      envName: string
      root: string
      lookupConfigurations: Array<LookupConfig>
      lookupKinds: Set<LookupKind>
      loadModule: (id: string) => Promise<void>
      resolveId: (id: string, importer?: string) => Promise<string | null>
      /**
       * In 'build' mode, resolution results are cached for performance.
       * In 'dev' mode (default), caching is disabled to avoid invalidation complexity with HMR.
       */
      mode?: 'dev' | 'build'
      /**
       * The framework being used (e.g., 'react', 'solid').
       */
      framework: CompileStartFrameworkOptions
      /**
       * The Vite environment name for the server function provider.
       */
      providerEnvName: string
      /**
       * Custom function ID generator (optional, defaults to hash-based).
       */
      generateFunctionId?: (opts: {
        filename: string
        functionName: string
      }) => string | undefined
      /**
       * Callback when server functions are discovered.
       * Called after each file is compiled with its new functions.
       */
      onServerFnsById?: (d: Record<string, ServerFn>) => void
      compilerTransforms?: Array<StartCompilerImportTransform> | undefined
      compilerPlugins?: Array<StartCompilerPlugin> | undefined
      serverFnProviderModuleDirectives?: ReadonlyArray<string> | undefined
      warn?: (message: string) => void
      /**
       * Returns the currently known server functions from previous builds.
       * Used by server callers to look up canonical extracted filenames.
       */
      getKnownServerFns: () => Record<string, ServerFn>
      devServerFnModuleSpecifierEncoder?: DevServerFnModuleSpecifierEncoder
    },
  ) {
    this.validLookupKinds = options.lookupKinds
    this.compilerPlugins = (options.compilerPlugins ?? []).filter((plugin) =>
      isStartCompilerPluginEnabledForEnv(plugin, options.env),
    )

    for (const transform of options.compilerTransforms ?? []) {
      const kind = getExternalLookupKind(transform)
      if (!this.validLookupKinds.has(kind)) continue

      this.externalTransformsByKind.set(kind, transform)

      const factoryNames = new Set<string>()
      for (const entry of transform.imports) {
        factoryNames.add(entry.rootExport)

        let rootExports = this.externalDirectCallKindsBySource.get(
          entry.libName,
        )
        if (!rootExports) {
          rootExports = new Map()
          this.externalDirectCallKindsBySource.set(entry.libName, rootExports)
        }
        rootExports.set(entry.rootExport, kind)
      }

      this.externalLookupSetup.set(kind, {
        type: 'directCall',
        factoryNames,
      })
    }
  }

  /**
   * Generates a unique function ID for a server function.
   * In dev mode, uses a base64-encoded JSON with file path and export name.
   * In build mode, uses SHA256 hash or custom generator.
   */
  private generateFunctionId(opts: {
    filename: string
    functionName: string
    extractedFilename: string
  }): string {
    if (this.mode === 'dev') {
      // In dev, encode the file path and export name for direct lookup.
      // Each bundler adapter supplies its own strategy for encoding
      // module specifiers that work with its dev server runtime.
      const encodeModuleSpecifier =
        this.options.devServerFnModuleSpecifierEncoder
      if (!encodeModuleSpecifier) {
        throw new Error(
          'devServerFnModuleSpecifierEncoder is required in dev mode.',
        )
      }
      const file = encodeModuleSpecifier({
        extractedFilename: opts.extractedFilename,
        root: this.options.root,
      })

      const serverFn = {
        file,
        export: opts.functionName,
      }
      return Buffer.from(JSON.stringify(serverFn), 'utf8').toString('base64url')
    }

    // Production build: use custom generator or hash
    const entryId = `${opts.filename}--${opts.functionName}`
    let functionId = this.entryIdToFunctionId.get(entryId)
    if (functionId === undefined) {
      const knownFn = Object.values(this.options.getKnownServerFns()).find(
        (serverFn) =>
          serverFn.functionName === opts.functionName &&
          serverFn.extractedFilename === opts.extractedFilename,
      )

      if (knownFn) {
        functionId = knownFn.functionId
      }

      if (this.options.generateFunctionId) {
        functionId ??= this.options.generateFunctionId({
          filename: opts.filename,
          functionName: opts.functionName,
        })
      }
      if (!functionId) {
        functionId = crypto.createHash('sha256').update(entryId).digest('hex')
      }
      // Deduplicate in case the generated id conflicts with an existing id
      if (this.functionIds.has(functionId)) {
        let deduplicatedId
        let iteration = 0
        do {
          deduplicatedId = `${functionId}_${++iteration}`
        } while (this.functionIds.has(deduplicatedId))
        functionId = deduplicatedId
      }
      this.entryIdToFunctionId.set(entryId, functionId)
      this.functionIds.add(functionId)
    }
    return functionId
  }

  private get mode(): 'dev' | 'build' {
    return this.options.mode ?? 'dev'
  }

  private getExternalDirectCallCandidates(
    kinds: Set<LookupKind>,
    moduleInfo: ModuleInfo,
  ): ExternalDirectCallCandidates {
    const identifiers = new Map<string, ExternalLookupKind>()
    const namespaces = new Map<string, Map<string, ExternalLookupKind>>()

    if (this.externalDirectCallKindsBySource.size === 0) {
      return { identifiers, namespaces }
    }

    for (const [localName, binding] of moduleInfo.bindings) {
      if (binding.type !== 'import') continue

      const rootExports = this.externalDirectCallKindsBySource.get(
        binding.source,
      )
      if (!rootExports) continue

      if (binding.importedName === '*') {
        const namespaceExports = new Map<string, ExternalLookupKind>()
        for (const [rootExport, kind] of rootExports) {
          if (kinds.has(kind)) {
            namespaceExports.set(rootExport, kind)
          }
        }
        if (namespaceExports.size > 0) {
          namespaces.set(localName, namespaceExports)
        }
      } else {
        const kind = rootExports.get(binding.importedName)
        if (kind && kinds.has(kind)) {
          identifiers.set(localName, kind)
        }
      }
    }

    return { identifiers, namespaces }
  }

  private async resolveIdCached(id: string, importer?: string) {
    if (this.mode === 'dev') {
      return this.options.resolveId(id, importer)
    }

    const cacheKey = importer ? `${importer}::${id}` : id
    const cached = this.resolveIdCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }
    const resolved = await this.options.resolveId(id, importer)
    this.resolveIdCache.set(cacheKey, resolved)
    return resolved
  }

  private getExportResolutionCache(moduleId: string) {
    let cache = this.exportResolutionCache.get(moduleId)
    if (!cache) {
      cache = new Map()
      this.exportResolutionCache.set(moduleId, cache)
    }
    return cache
  }

  private init() {
    // Register internal stub package exports for recognition.
    // These don't need module resolution - only the knownRootImports fast path.
    this.knownRootImports.set(
      '@tanstack/start-fn-stubs',
      new Map<string, Kind>([
        ['createIsomorphicFn', 'IsomorphicFn'],
        ['createServerOnlyFn', 'ServerOnlyFn'],
        ['createClientOnlyFn', 'ClientOnlyFn'],
      ]),
    )

    // Register start-client-core exports for internal package usage.
    // These don't need module resolution - only the knownRootImports fast path.
    this.knownRootImports.set(
      '@tanstack/start-client-core',
      new Map<string, Kind>([
        ['createServerFn', 'Root'],
        ['createIsomorphicFn', 'IsomorphicFn'],
        ['createServerOnlyFn', 'ServerOnlyFn'],
        ['createClientOnlyFn', 'ClientOnlyFn'],
        ['createMiddleware', 'Middleware'],
        ['createStart', 'Root'],
      ]),
    )

    for (const config of this.options.lookupConfigurations) {
      // Populate the fast lookup map for direct imports (by package name)
      // This allows O(1) recognition of imports from known packages.
      let libExports = this.knownRootImports.get(config.libName)
      if (!libExports) {
        libExports = new Map()
        this.knownRootImports.set(config.libName, libExports)
      }
      libExports.set(config.rootExport, config.kind)

      // For JSX lookups (e.g., ClientOnlyJSX), we only need the knownRootImports
      // fast path to verify imports. Skip synthetic root module setup.
      if (config.kind !== 'Root') {
        const setup = getLookupSetup(config.kind, this.externalLookupSetup)
        if (setup?.type === 'jsx') {
          continue
        }
      }

      // Root lookup metadata is synthetic package-level state, not a real
      // resolved module. Keep the ID stable across bundlers and export-map
      // behavior by always keying it to the package specifier itself.
      const libId = config.libName

      let rootModule = this.moduleCache.get(libId)
      if (!rootModule) {
        // insert root binding
        rootModule = {
          bindings: new Map(),
          exports: new Map(),
          id: libId,
          reExportAllSources: [],
        }
        this.moduleCache.set(libId, rootModule)
      }

      rootModule.exports.set(config.rootExport, config.rootExport)
      rootModule.exports.set('*', config.rootExport)
      rootModule.bindings.set(config.rootExport, {
        type: 'var',
        init: null, // Not needed since resolvedKind is set
        resolvedKind: config.kind satisfies Kind,
      })
      this.moduleCache.set(libId, rootModule)
    }

    this.initialized = true
  }

  /**
   * Extracts bindings and exports from an already-parsed AST.
   */
  private extractModuleInfo(
    ast: ReturnType<typeof parseAst>,
    id: string,
  ): ModuleInfo {
    const extracted = extractModuleInfoFromAst(ast)

    const info: ModuleInfo = {
      id,
      bindings: new Map(extracted.bindings),
      exports: extracted.exports,
      reExportAllSources: extracted.reExportAllSources,
    }
    this.moduleCache.set(id, info)
    return info
  }

  public ingestModule({
    code,
    id,
    parserFilename,
  }: {
    code: string
    id: string
    parserFilename?: string
  }) {
    const ast = parseAst({ code, filename: parserFilename ?? cleanId(id) })
    const info = this.extractModuleInfo(ast, id)
    return { info, ast }
  }

  public invalidateModule(id: string) {
    return this.invalidateModules([id]).size > 0
  }

  public invalidateModules(ids: Iterable<string>): Set<string> {
    const normalizedIds = new Set<string>()

    for (const id of ids) {
      normalizedIds.add(cleanId(id))

      for (const plugin of this.compilerPlugins) {
        plugin.invalidateModule?.({ id, envName: this.options.envName })
      }
    }

    const deletedModuleIds = new Set<string>()
    if (normalizedIds.size === 0) {
      return deletedModuleIds
    }

    for (const moduleId of Array.from(this.moduleCache.keys())) {
      const normalizedModuleId = cleanId(moduleId)
      if (normalizedIds.has(normalizedModuleId)) {
        this.moduleCache.delete(moduleId)
        deletedModuleIds.add(normalizedModuleId)
      }
    }

    // Root import metadata is synthetic compiler state and should survive HMR.
    // The stale dev state lives in per-module resolvedKind memoization.
    for (const [moduleId, moduleInfo] of this.moduleCache) {
      if (this.knownRootImports.has(moduleId)) {
        continue
      }

      for (const binding of moduleInfo.bindings.values()) {
        binding.resolvedKind = undefined
      }
    }

    // Build-mode caches are cheap to rebuild and may point at removed entries.
    this.resolveIdCache.clear()
    this.exportResolutionCache.clear()

    return deletedModuleIds
  }

  public async getTransitiveImporters(
    ids: string | Iterable<string>,
  ): Promise<Set<string>> {
    const discoveredImporters = new Set<string>()
    const pendingTargets =
      typeof ids === 'string'
        ? [cleanId(ids)]
        : Array.from(ids, (id) => cleanId(id))
    const visitedTargets = new Set<string>()
    const resolveCache = new Map<string, Promise<string | null>>()
    const importersByTarget = new Map<string, Set<string>>()

    const resolveSource = (source: string, importer: string) => {
      const cacheKey = `${importer}::${source}`
      let resolved = resolveCache.get(cacheKey)

      if (!resolved) {
        resolved = this.resolveIdCached(source, importer)
        resolveCache.set(cacheKey, resolved)
      }

      return resolved
    }

    await Promise.all(
      Array.from(this.moduleCache.values()).map(async (moduleInfo) => {
        if (this.knownRootImports.has(moduleInfo.id)) {
          return
        }

        const moduleId = cleanId(moduleInfo.id)
        const importSources = new Set(moduleInfo.reExportAllSources)

        for (const binding of moduleInfo.bindings.values()) {
          if (binding.type === 'import') {
            importSources.add(binding.source)
          }
        }

        await Promise.all(
          Array.from(importSources, async (source) => {
            const resolved = await resolveSource(source, moduleInfo.id)
            if (!resolved) return

            const targetId = cleanId(resolved)
            if (targetId === moduleId) return

            let importers = importersByTarget.get(targetId)
            if (!importers) {
              importers = new Set()
              importersByTarget.set(targetId, importers)
            }
            importers.add(moduleId)
          }),
        )
      }),
    )

    while (pendingTargets.length > 0) {
      const targetId = pendingTargets.pop()!

      if (visitedTargets.has(targetId)) {
        continue
      }

      visitedTargets.add(targetId)

      for (const importerId of importersByTarget.get(targetId) ?? []) {
        if (discoveredImporters.has(importerId)) {
          continue
        }

        discoveredImporters.add(importerId)
        pendingTargets.push(importerId)
      }
    }

    return discoveredImporters
  }

  public async compile({
    code,
    id,
    parserFilename,
    detectedKinds,
    warn,
  }: {
    code: string
    id: string
    parserFilename?: string
    /** Pre-detected kinds present in this file. If not provided, all valid kinds are checked. */
    detectedKinds?: Set<LookupKind>
    warn?: (message: string) => void
  }) {
    if (!this.initialized) {
      await this.init()
    }

    // Use detected kinds if provided, otherwise fall back to all valid kinds for this env
    const fileKinds = detectedKinds
      ? new Set([...detectedKinds].filter((k) => this.validLookupKinds.has(k)))
      : this.validLookupKinds

    const astTransformPlugins = this.getAstTransformPluginsForCode(code)
    // Always parse and extract module info upfront.
    // This ensures the module is cached for import resolution even if no candidates are found.
    const ast = this.ingestModule({ code, id, parserFilename }).ast
    const warnFn = warn ?? this.options.warn
    let astHasChanges = false

    builtInTransforms: {
      // Early exit if no built-in or import transforms need this file.
      if (fileKinds.size === 0) {
        break builtInTransforms
      }

      const hasExternalKinds = hasExternalLookupKinds(fileKinds)
      const checkDirectCalls =
        hasBuiltInDirectCallKinds(fileKinds) ||
        (fileKinds.has('ServerFn') &&
          !hasExternalKinds &&
          hasBuiltInDirectCallKinds(this.validLookupKinds))
      // Optimization: ServerFn is always a top-level declaration (must be assigned to a variable).
      // If the file only has ServerFn, we can skip full AST traversal and only visit
      // the specific top-level declarations that have candidates.
      const canUseFastPath = areAllKindsTopLevelOnly(fileKinds)

      // Single-pass traversal to:
      // 1. Collect candidate paths (only candidates, not all CallExpressions)
      // 2. Build a map for looking up paths of nested calls in method chains
      const candidatePaths: Array<CallExpressionCandidate> = []
      // Map for nested chain lookup - only populated for CallExpressions that are
      // part of a method chain (callee.object is a CallExpression)
      const chainCallPaths = new Map<
        t.CallExpression,
        babel.NodePath<t.CallExpression>
      >()

      // JSX candidates (e.g., <ClientOnly>)
      const jsxCandidatePaths: Array<babel.NodePath<t.JSXElement>> = []
      const checkJSX = needsJSXDetection(fileKinds, this.externalLookupSetup)
      // Get module info that was just cached by ingestModule
      const moduleInfo = this.moduleCache.get(id)!
      const externalDirectCallCandidates = this.getExternalDirectCallCandidates(
        fileKinds,
        moduleInfo,
      )
      const checkExternalDirectCalls = hasExternalDirectCallCandidates(
        externalDirectCallCandidates,
      )

      if (canUseFastPath) {
        // Fast path: only visit top-level statements that have potential candidates

        // Collect indices of top-level statements that contain candidates
        const candidateIndices: Array<number> = []
        for (let i = 0; i < ast.program.body.length; i++) {
          const node = ast.program.body[i]!
          let declarations: Array<t.VariableDeclarator> | undefined

          if (t.isVariableDeclaration(node)) {
            declarations = node.declarations
          } else if (t.isExportNamedDeclaration(node) && node.declaration) {
            if (t.isVariableDeclaration(node.declaration)) {
              declarations = node.declaration.declarations
            }
          }

          if (declarations) {
            for (const decl of declarations) {
              const init = getPotentialCandidateCallExpression(decl.init)
              if (init) {
                if (
                  isMethodChainCandidate(init, fileKinds) ||
                  (checkDirectCalls && isTopLevelDirectCallCandidateNode(init))
                ) {
                  candidateIndices.push(i)
                  break // Only need to mark this statement once
                }
              }
            }
          }
        }

        // Early exit: no potential candidates found at top level
        if (candidateIndices.length === 0) {
          break builtInTransforms
        }

        // Targeted traversal: only visit the specific statements that have candidates
        // This is much faster than traversing the entire AST
        babel.traverse(ast, {
          Program(programPath) {
            const bodyPaths = programPath.get('body')
            for (const idx of candidateIndices) {
              const stmtPath = bodyPaths[idx]
              if (!stmtPath) continue

              // Traverse only this statement's subtree
              stmtPath.traverse({
                CallExpression(path) {
                  const node = path.node
                  const parent = path.parent

                  // Check if this call is part of a larger chain (inner call)
                  if (
                    t.isMemberExpression(parent) &&
                    t.isCallExpression(path.parentPath.parent)
                  ) {
                    chainCallPaths.set(node, path)
                    return
                  }

                  // Method chain pattern
                  if (isMethodChainCandidate(node, fileKinds)) {
                    candidatePaths.push({ path })
                    return
                  }

                  if (checkExternalDirectCalls) {
                    const kind = getExternalDirectCallCandidateKind(
                      path,
                      externalDirectCallCandidates,
                    )
                    if (kind) {
                      candidatePaths.push({ path, kind })
                      return
                    }
                  }

                  if (isTopLevelDirectCallCandidate(path)) {
                    candidatePaths.push({ path })
                  }
                },
              })
            }
            // Stop traversal after processing Program
            programPath.stop()
          },
        })
      } else {
        // Normal path: full traversal for non-fast-path kinds
        babel.traverse(ast, {
          CallExpression: (path) => {
            const node = path.node
            const parent = path.parent

            // Check if this call is part of a larger chain (inner call)
            // If so, store it for method chain lookup but don't treat as candidate
            if (
              t.isMemberExpression(parent) &&
              t.isCallExpression(path.parentPath.parent)
            ) {
              // This is an inner call in a chain - store for later lookup
              chainCallPaths.set(node, path)
              return
            }

            // Pattern 1: Method chain pattern (.handler(), .server(), .client(), etc.)
            if (isMethodChainCandidate(node, fileKinds)) {
              candidatePaths.push({ path })
              return
            }

            // External direct-call transforms are import-bound. Direct imports
            // already identify the transform kind, so skip async import tracing.
            if (checkExternalDirectCalls) {
              const kind = getExternalDirectCallCandidateKind(
                path,
                externalDirectCallCandidates,
              )
              if (kind) {
                candidatePaths.push({ path, kind })
                return
              }
            }

            if (checkDirectCalls && isTopLevelDirectCallCandidate(path)) {
              candidatePaths.push({ path })
              return
            }

            // Pattern 2: Direct call pattern
            if (checkDirectCalls) {
              if (
                isNestedDirectCallCandidate(
                  node,
                  fileKinds,
                  this.externalLookupSetup,
                )
              ) {
                candidatePaths.push({ path })
                return
              }
            }
          },
          // Pattern 3: JSX element pattern (e.g., <ClientOnly>)
          // Collect JSX elements where the component is imported from a known package
          // and resolves to a JSX kind (e.g., ClientOnly from @tanstack/react-router)
          JSXElement: (path) => {
            if (!checkJSX) return

            const openingElement = path.node.openingElement
            const nameNode = openingElement.name

            // Only handle simple identifier names (not namespaced or member expressions)
            if (!t.isJSXIdentifier(nameNode)) return

            const componentName = nameNode.name
            const binding = moduleInfo.bindings.get(componentName)

            // Must be an import binding from a known package
            if (!binding || binding.type !== 'import') return

            // Verify the import source is a known TanStack router package
            const knownExports = this.knownRootImports.get(binding.source)
            if (!knownExports) return

            // Verify the imported name resolves to a JSX kind (e.g., ClientOnlyJSX)
            const kind = knownExports.get(binding.importedName)
            if (kind !== 'ClientOnlyJSX') return

            jsxCandidatePaths.push(path)
          },
        })
      }

      if (candidatePaths.length === 0 && jsxCandidatePaths.length === 0) {
        break builtInTransforms
      }

      // Resolve only candidates whose import scan did not already prove the kind.
      const resolvedCandidates: Array<{
        path: babel.NodePath<t.CallExpression>
        kind: Kind
      }> = []
      const unresolvedCandidates: Array<CallExpressionCandidate> = []

      for (const candidate of candidatePaths) {
        if (candidate.kind) {
          resolvedCandidates.push({
            path: candidate.path,
            kind: candidate.kind,
          })
        } else {
          unresolvedCandidates.push(candidate)
        }
      }

      if (unresolvedCandidates.length > 0) {
        resolvedCandidates.push(
          ...(await Promise.all(
            unresolvedCandidates.map(async (candidate) => ({
              path: candidate.path,
              kind: await this.resolveExprKind(candidate.path.node, id),
            })),
          )),
        )
      }

      // Filter to valid candidates
      const validCandidates = resolvedCandidates.filter(({ path, kind }) => {
        if (
          !this.validLookupKinds.has(
            kind as Exclude<LookupKind, 'ClientOnlyJSX'>,
          )
        ) {
          return false
        }

        if (
          isLookupKind(kind) &&
          kind !== 'ClientOnlyJSX' &&
          !isMethodChainCandidate(path.node, fileKinds)
        ) {
          return isDirectCallCandidateForKind(kind, this.externalLookupSetup)
        }

        return true
      }) as Array<{
        path: babel.NodePath<t.CallExpression>
        kind: Exclude<LookupKind, 'ClientOnlyJSX'>
      }>

      if (validCandidates.length === 0 && jsxCandidatePaths.length === 0) {
        break builtInTransforms
      }

      // Process valid candidates to collect method chains
      const pathsToRewrite: Array<{
        path: babel.NodePath<t.CallExpression>
        kind: Exclude<LookupKind, 'ClientOnlyJSX'>
        methodChain: MethodChainPaths
      }> = []

      for (const { path, kind } of validCandidates) {
        const node = path.node

        // Collect method chain paths by walking DOWN from root through the chain
        const methodChain: MethodChainPaths = {
          middleware: null,
          validator: null,
          // TODO remove upon stable
          inputValidator: null,
          handler: null,
          server: null,
          client: null,
        }

        // Walk down the call chain using nodes, look up paths from map
        let currentNode: t.CallExpression = node
        let currentPath: babel.NodePath<t.CallExpression> = path

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          const callee = currentNode.callee
          if (!t.isMemberExpression(callee)) {
            break
          }

          // Record method chain path if it's a known method
          if (t.isIdentifier(callee.property)) {
            const name = callee.property.name as keyof MethodChainPaths
            if (name in methodChain) {
              // Get first argument path
              const args = currentPath.get('arguments')
              const firstArgPath =
                Array.isArray(args) && args.length > 0
                  ? (args[0] ?? null)
                  : null
              methodChain[name] = {
                callPath: currentPath,
                firstArgPath,
              }
            }
          }

          // Move to the inner call (the object of the member expression)
          if (!t.isCallExpression(callee.object)) {
            break
          }
          currentNode = callee.object
          // Look up path from chain map, or use candidate path if not found
          const nextPath = chainCallPaths.get(currentNode)
          if (!nextPath) {
            break
          }
          currentPath = nextPath
        }

        pathsToRewrite.push({ path, kind, methodChain })
      }

      const refIdents = findReferencedIdentifiers(ast)

      const context: CompilationContext = {
        ast,
        id,
        code,
        env: this.options.env,
        envName: this.options.envName,
        mode: this.mode,
        root: this.options.root,
        framework: this.options.framework,
        providerEnvName: this.options.providerEnvName,
        types: t,
        parseExpression: (expressionCode) =>
          babel.template.expression(expressionCode, {
            placeholderPattern: false,
          })() as t.Expression,
        warn: warnFn,

        generateFunctionId: (opts) => this.generateFunctionId(opts),
        getKnownServerFns: this.options.getKnownServerFns,
        serverFnProviderModuleDirectives:
          this.options.serverFnProviderModuleDirectives,
        onServerFnsById: this.options.onServerFnsById,
      }

      // Group candidates by kind for batch processing
      const candidatesByKind = new Map<
        Exclude<LookupKind, 'ClientOnlyJSX'>,
        Array<RewriteCandidate>
      >()

      for (const { path: candidatePath, kind, methodChain } of pathsToRewrite) {
        const candidate: RewriteCandidate = { path: candidatePath, methodChain }
        const existing = candidatesByKind.get(kind)
        if (existing) {
          existing.push(candidate)
        } else {
          candidatesByKind.set(kind, [candidate])
        }
      }

      // External transforms run before built-ins by default so they can augment
      // user handlers before server function extraction clones provider bodies.
      this.runExternalTransforms('pre', candidatesByKind, context)

      for (const kind of BuiltInKindHandlerOrder) {
        const candidates = candidatesByKind.get(kind)
        if (!candidates) continue
        const handler = BuiltInKindHandlers[kind]
        handler(candidates, context, kind)
      }

      this.runExternalTransforms('post', candidatesByKind, context)

      // Handle JSX candidates (e.g., <ClientOnly>)
      // Validation was already done during traversal - just call the handler
      for (const jsxPath of jsxCandidatePaths) {
        handleClientOnlyJSX(jsxPath, { env: 'server' })
      }

      deadCodeElimination(ast, refIdents)
      astHasChanges = true
    }

    if (astTransformPlugins.length > 0) {
      astHasChanges =
        this.runAstTransforms({
          ast,
          code,
          id,
          transforms: astTransformPlugins,
          warn: warnFn,
        }) || astHasChanges
    }

    return astHasChanges ? this.generateResultFromAst(ast, code, id) : null
  }

  private generateResultFromAst(
    ast: ParsedAst,
    sourceCode: string,
    id: string,
  ): StartCompilerTransformResult {
    const result = generateFromAst(ast, {
      sourceMaps: true,
      sourceFileName: id,
      filename: id,
    })

    // @babel/generator does not populate sourcesContent because it only has
    // the AST, not the original text.  Without this, Vite's composed sourcemap
    // omits the original source, causing downstream consumers to fall back to
    // the compiled output and fail to resolve original line numbers.
    if (result.map) {
      result.map.sourcesContent = [sourceCode]
    }

    return result
  }

  private getAstTransformPluginsForCode(
    code: string,
  ): Array<StartCompilerAstPlugin> {
    return this.compilerPlugins.filter(
      (plugin): plugin is StartCompilerAstPlugin => {
        if (!plugin.transformAst) return false
        if (!plugin.detect) return true
        plugin.detect.lastIndex = 0
        return plugin.detect.test(code)
      },
    )
  }

  private runAstTransforms({
    ast,
    code,
    id,
    transforms,
    warn,
  }: {
    ast: ParsedAst
    code: string
    id: string
    transforms: Array<StartCompilerAstPlugin>
    warn?: (message: string) => void
  }): boolean {
    let modified = false

    for (const plugin of transforms) {
      const context = {
        ast,
        code,
        id,
        env: this.options.env,
        envName: this.options.envName,
        mode: this.mode,
        root: this.options.root,
        framework: this.options.framework,
        providerEnvName: this.options.providerEnvName,
        types: t,
        parseExpression: (expressionCode: string) =>
          babel.template.expression(expressionCode, {
            placeholderPattern: false,
          })() as t.Expression,
        warn,
      }

      modified = plugin.transformAst(context) || modified
    }

    return modified
  }

  private runExternalTransforms(
    order: 'pre' | 'post',
    candidatesByKind: Map<
      Exclude<LookupKind, 'ClientOnlyJSX'>,
      Array<RewriteCandidate>
    >,
    context: CompilationContext,
  ) {
    for (const [kind, transform] of this.externalTransformsByKind) {
      if ((transform.order ?? 'pre') !== order) continue

      const candidates = candidatesByKind.get(kind)
      if (!candidates) continue

      transform.transform(candidates, context)
    }
  }

  private async resolveIdentifierKind(
    ident: string,
    id: string,
    visited = new Set<string>(),
  ): Promise<Kind> {
    const info = await this.getModuleInfo(id)

    const binding = info.bindings.get(ident)
    if (!binding) {
      return 'None'
    }
    if (binding.resolvedKind) {
      return binding.resolvedKind
    }

    // TODO improve cycle detection? should we throw here instead of returning 'None'?
    // prevent cycles
    const vKey = `${cleanId(id)}:${ident}`
    if (visited.has(vKey)) {
      return 'None'
    }
    visited.add(vKey)

    const resolvedKind = await this.resolveBindingKind(binding, id, visited)
    binding.resolvedKind = resolvedKind
    return resolvedKind
  }

  /**
   * Recursively find an export in a module, following `export * from` chains.
   * Returns the module info and binding if found, or undefined if not found.
   */
  private async findExportInModule(
    moduleInfo: ModuleInfo,
    exportName: string,
    visitedModules = new Set<string>(),
  ): Promise<ExportResolution | undefined> {
    const isBuildMode = this.mode === 'build'

    // Check cache first (only for top-level calls in build mode)
    if (isBuildMode && visitedModules.size === 0) {
      const moduleCache = this.exportResolutionCache.get(moduleInfo.id)
      if (moduleCache) {
        const cached = moduleCache.get(exportName)
        if (cached !== undefined) {
          return cached ?? undefined
        }
      }
    }

    // Prevent infinite loops in circular re-exports
    if (visitedModules.has(moduleInfo.id)) {
      return undefined
    }
    visitedModules.add(moduleInfo.id)

    // First check direct exports
    const localBindingName = moduleInfo.exports.get(exportName)
    if (localBindingName) {
      const binding = moduleInfo.bindings.get(localBindingName)
      if (binding) {
        const result = { moduleInfo, localName: localBindingName, binding }
        // Cache the result (build mode only)
        if (isBuildMode) {
          this.getExportResolutionCache(moduleInfo.id).set(exportName, result)
        }
        return result
      }
    }

    // If not found, recursively check re-export-all sources in parallel
    // Valid code won't have duplicate exports across chains, so first match wins
    if (moduleInfo.reExportAllSources.length > 0) {
      const results = await Promise.all(
        moduleInfo.reExportAllSources.map(async (reExportSource) => {
          const reExportTarget = await this.resolveIdCached(
            reExportSource,
            moduleInfo.id,
          )

          if (reExportTarget) {
            const reExportModule = await this.getModuleInfo(reExportTarget)
            return this.findExportInModule(
              reExportModule,
              exportName,
              visitedModules,
            )
          }
          return undefined
        }),
      )
      // Return the first valid result
      for (const result of results) {
        if (result) {
          // Cache the result (build mode only)
          if (isBuildMode) {
            this.getExportResolutionCache(moduleInfo.id).set(exportName, result)
          }
          return result
        }
      }
    }

    // Cache negative result (build mode only)
    if (isBuildMode) {
      this.getExportResolutionCache(moduleInfo.id).set(exportName, null)
    }
    return undefined
  }

  private async resolveBindingTarget(
    resolution: ExportResolution,
    visited = new Set<string>(),
  ): Promise<ExportResolution | undefined> {
    const key = `${cleanId(resolution.moduleInfo.id)}:${resolution.localName}`
    if (visited.has(key)) {
      return undefined
    }
    visited.add(key)

    if (resolution.binding.type !== 'import') {
      return resolution
    }

    const target = await this.resolveIdCached(
      resolution.binding.source,
      resolution.moduleInfo.id,
    )
    if (!target) {
      return undefined
    }

    const importedModule = await this.getModuleInfo(target)
    const found = await this.findExportInModule(
      importedModule,
      resolution.binding.importedName,
    )
    if (!found) {
      return undefined
    }

    return this.resolveBindingTarget(found, visited)
  }

  private async resolveKnownImportKind(
    binding: ImportBinding,
    resolved?: ExportResolution,
  ): Promise<Kind> {
    const directKind =
      this.knownRootImports.get(binding.source)?.get(binding.importedName) ??
      'None'
    if (directKind !== 'None') {
      return directKind
    }

    if (!resolved) {
      return 'None'
    }

    for (const [source, rootExports] of this.knownRootImports) {
      const kind = rootExports.get(binding.importedName)
      if (!kind) {
        continue
      }

      let targetId: string | null
      try {
        targetId = await this.resolveIdCached(source, resolved.moduleInfo.id)
      } catch {
        continue
      }

      if (!targetId) {
        continue
      }

      try {
        const rootModule = await this.getModuleInfo(targetId)
        const found = await this.findExportInModule(
          rootModule,
          binding.importedName,
        )
        const target = found
          ? ((await this.resolveBindingTarget(found)) ?? found)
          : undefined

        // Match by resolved binding identity, not by export name alone.
        if (
          target &&
          cleanId(resolved.moduleInfo.id) === cleanId(target.moduleInfo.id) &&
          resolved.localName === target.localName
        ) {
          return kind
        }
      } catch {
        continue
      }
    }

    return 'None'
  }

  private async resolveImportKind(
    binding: ImportBinding,
    fileId: string,
    visited: Set<string>,
  ): Promise<Kind> {
    const directKnownKind = await this.resolveKnownImportKind(binding)
    if (directKnownKind !== 'None') {
      binding.resolvedKind = directKnownKind
      return directKnownKind
    }

    if (binding.importedName === '*') {
      return 'None'
    }

    const target = await this.resolveIdCached(binding.source, fileId)
    if (!target) {
      return 'None'
    }

    const importedModule = await this.getModuleInfo(target)
    const found = await this.findExportInModule(
      importedModule,
      binding.importedName,
    )
    if (!found) {
      return 'None'
    }

    const knownKind = await this.resolveKnownImportKind(binding, found)
    if (knownKind !== 'None') {
      found.binding.resolvedKind = knownKind
      binding.resolvedKind = knownKind
      return knownKind
    }

    if (found.binding.resolvedKind) {
      return found.binding.resolvedKind
    }

    // Import aliases can form cycles, e.g. A re-exports from B while B
    // re-exports from A. Track the exported binding before following it.
    const vKey = `${cleanId(found.moduleInfo.id)}:${found.localName}`
    if (visited.has(vKey)) {
      return 'None'
    }
    visited.add(vKey)

    const resolvedKind = await this.resolveBindingKind(
      found.binding,
      found.moduleInfo.id,
      visited,
    )
    found.binding.resolvedKind = resolvedKind
    return resolvedKind
  }

  private async resolveBindingKind(
    binding: Binding,
    fileId: string,
    visited = new Set<string>(),
  ): Promise<Kind> {
    if (binding.resolvedKind) {
      return binding.resolvedKind
    }
    if (binding.type === 'import') {
      return this.resolveImportKind(binding, fileId, visited)
    }

    const resolvedKind = await this.resolveExprKind(
      binding.init,
      fileId,
      visited,
    )
    // When a var binding's init is a call to a directCall factory
    // (e.g., `const myFn = createServerOnlyFn(() => ...)`), the binding holds
    // the RESULT of the factory, not the factory itself. Clear the kind so
    // `myFn()` isn't incorrectly matched as a directCall candidate.
    // We only clear when the init is a CallExpression — an alias like
    // `const createSO = createServerOnlyFn` should still propagate the kind.
    if (
      isLookupKind(resolvedKind) &&
      getLookupSetup(resolvedKind, this.externalLookupSetup)?.type ===
        'directCall' &&
      binding.init &&
      t.isCallExpression(unwrapExpression(binding.init))
    ) {
      binding.resolvedKind = 'None'
      return 'None'
    }
    binding.resolvedKind = resolvedKind
    return resolvedKind
  }

  private async resolveExprKind(
    expr: t.Expression | null,
    fileId: string,
    visited = new Set<string>(),
  ): Promise<Kind> {
    if (!expr) {
      return 'None'
    }

    expr = unwrapExpression(expr)

    let result: Kind = 'None'

    if (t.isCallExpression(expr)) {
      if (!t.isExpression(expr.callee)) {
        return 'None'
      }
      const calleeKind = await this.resolveCalleeKind(
        expr.callee,
        fileId,
        visited,
      )
      if (calleeKind === 'Root' || calleeKind === 'Builder') {
        return 'Builder'
      }
      // For method chain patterns (callee is MemberExpression like .server() or .client()),
      // return the resolved kind if valid
      if (t.isMemberExpression(expr.callee)) {
        if (this.validLookupKinds.has(calleeKind as LookupKind)) {
          return calleeKind
        }
      }
      // For direct calls (callee is Identifier like createServerOnlyFn()),
      // trust calleeKind if it resolved to a valid LookupKind. This means
      // resolveBindingKind successfully traced the import back to
      // @tanstack/start-fn-stubs (via fast path or slow path through re-exports).
      // This handles both direct imports from @tanstack/react-start and imports
      // from intermediate packages that re-export from @tanstack/start-client-core.
      if (t.isIdentifier(expr.callee)) {
        if (this.validLookupKinds.has(calleeKind as LookupKind)) {
          return calleeKind
        }
      }
    } else if (t.isMemberExpression(expr) && t.isIdentifier(expr.property)) {
      result = await this.resolveCalleeKind(expr.object, fileId, visited)
    }

    if (result === 'None' && t.isIdentifier(expr)) {
      result = await this.resolveIdentifierKind(expr.name, fileId, visited)
    }

    return result
  }

  private async resolveCalleeKind(
    callee: t.Expression,
    fileId: string,
    visited = new Set<string>(),
  ): Promise<Kind> {
    if (t.isIdentifier(callee)) {
      return this.resolveIdentifierKind(callee.name, fileId, visited)
    }

    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      const prop = callee.property.name

      // Check if this property matches any method chain pattern
      const possibleKinds = IdentifierToKinds.get(prop)
      if (possibleKinds) {
        // Resolve base expression ONCE and reuse for all pattern checks
        const base = await this.resolveExprKind(callee.object, fileId, visited)

        // Check each possible kind that uses this identifier
        for (const kind of possibleKinds) {
          if (!this.validLookupKinds.has(kind)) continue

          if (kind === 'ServerFn') {
            if (base === 'Root' || base === 'Builder') {
              return 'ServerFn'
            }
          } else if (kind === 'Middleware') {
            if (
              base === 'Root' ||
              base === 'Builder' ||
              base === 'Middleware'
            ) {
              return 'Middleware'
            }
          } else if (kind === 'IsomorphicFn') {
            if (
              base === 'Root' ||
              base === 'Builder' ||
              base === 'IsomorphicFn'
            ) {
              return 'IsomorphicFn'
            }
          }
        }
      }

      // Check if the object is a namespace import
      if (t.isIdentifier(callee.object)) {
        const info = await this.getModuleInfo(fileId)
        const binding = info.bindings.get(callee.object.name)
        if (
          binding &&
          binding.type === 'import' &&
          binding.importedName === '*'
        ) {
          return this.resolveImportKind(
            {
              type: 'import',
              source: binding.source,
              importedName: callee.property.name,
            },
            fileId,
            visited,
          )
        }
      }
      return this.resolveExprKind(callee.object, fileId, visited)
    }

    // handle nested expressions
    return this.resolveExprKind(callee, fileId, visited)
  }

  private async getModuleInfo(id: string) {
    let cached = this.moduleCache.get(id)
    if (cached) {
      return cached
    }

    await this.options.loadModule(id)

    cached = this.moduleCache.get(id)
    if (!cached) {
      throw new Error(`could not load module info for ${id}`)
    }
    return cached
  }
}

/**
 * Checks if a CallExpression has a method chain pattern that matches any of the lookup kinds.
 * E.g., `.handler()`, `.server()`, `.client()`, `.createMiddlewares()`
 */
function isMethodChainCandidate(
  node: t.CallExpression,
  lookupKinds: Set<LookupKind>,
): boolean {
  const callee = node.callee
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) {
    return false
  }

  // Use pre-computed map for O(1) lookup
  // IdentifierToKinds maps identifier -> Set<LookupKind> to handle shared identifiers
  const possibleKinds = IdentifierToKinds.get(callee.property.name)
  if (possibleKinds) {
    // Check if any of the possible kinds are in the valid lookup kinds
    for (const kind of possibleKinds) {
      if (lookupKinds.has(kind)) {
        return true
      }
    }
  }

  return false
}
