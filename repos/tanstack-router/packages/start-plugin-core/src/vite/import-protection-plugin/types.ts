import type { CompileStartFrameworkOptions, GetConfigFn } from '../../types'
import type { ImportProtectionBehavior } from '../../schema'
import type { CompiledMatcher } from '../../import-protection/matchers'
import type { ImportGraph, ViolationInfo } from '../../import-protection/trace'
import type {
  ImportLocCache,
  TransformResult,
  TransformResultProvider,
} from '../../import-protection/sourceLocation'

/** Compiled deny/exclude patterns for one environment (client or server). */
export interface EnvRules {
  specifiers: Array<CompiledMatcher>
  files: Array<CompiledMatcher>
  excludeFiles: Array<CompiledMatcher>
}

export interface PluginConfig {
  enabled: boolean
  root: string
  command: 'build' | 'serve'
  bundledDev: boolean
  srcDirectory: string
  framework: CompileStartFrameworkOptions
  effectiveBehavior: ImportProtectionBehavior
  mockAccess: 'error' | 'warn' | 'off'
  logMode: 'once' | 'always'
  maxTraceDepth: number
  compiledRules: {
    client: EnvRules
    server: EnvRules
  }
  includeMatchers: Array<CompiledMatcher>
  excludeMatchers: Array<CompiledMatcher>
  ignoreImporterMatchers: Array<CompiledMatcher>
  markerSpecifiers: { serverOnly: Set<string>; clientOnly: Set<string> }
  envTypeMap: Map<string, 'client' | 'server'>
  onViolation?: (
    info: ViolationInfo,
  ) => boolean | void | Promise<boolean | void>
}

export interface EnvState {
  graph: ImportGraph
  mockExportsByImporter: Map<string, Map<string, Array<string>>>
  resolveCache: Map<string, string | null>
  resolveCacheByFile: Map<string, Set<string>>
  importLocCache: ImportLocCache
  seenViolations: Set<string>
  serverFnLookupModules: Set<string>
  transformResultCache: Map<string, TransformResult>
  transformResultKeysByFile: Map<string, Set<string>>
  transformResultProvider: TransformResultProvider
  postTransformImports: Map<string, Set<string>>
  pendingViolations: Map<string, Array<PendingViolation>>
  deferredBuildViolations: Array<DeferredBuildViolation>
}

export interface PendingViolation {
  info: ViolationInfo
  /** True when the violation originates from a pre-transform resolveId call
   * (e.g. server-fn lookup).  These need edge-survival verification because
   * the Start compiler may strip the import later. */
  fromPreTransformResolve?: boolean
}

export interface DeferredBuildViolation {
  info: ViolationInfo
  mockModuleId: string
  checkModuleId?: string
}

export interface SharedState {
  fileMarkerKind: Map<string, 'server' | 'client'>
}

export interface ImportProtectionPluginOptions {
  getConfig: GetConfigFn
  framework: CompileStartFrameworkOptions
  environments: Array<{ name: string; type: 'client' | 'server' }>
  providerEnvName: string
}

export type ModuleGraphNode = {
  id?: string | null
  url?: string
  importers: Set<ModuleGraphNode>
}

export type ViolationReporter = {
  warn: (msg: string) => void
  error: (msg: string) => never
  resolve?: (
    source: string,
    importer?: string,
    options?: {
      skipSelf?: boolean
      custom?: Record<string, unknown>
    },
  ) => Promise<{ id: string; external?: boolean | 'absolute' } | null>
  getModuleInfo?: (id: string) => { code?: string | null } | null
}

export type HandleViolationResult = string | undefined
