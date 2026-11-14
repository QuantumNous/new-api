import { writeFileSync } from 'node:fs'
import { normalizePath } from 'vite'
import { dirname, relative } from 'pathe'

import { escapeRegExp, resolveViteId } from '../../utils'
import { VITE_ENVIRONMENT_NAMES } from '../../constants'
import {
  ImportGraph,
  buildTrace,
  formatViolation,
} from '../../import-protection/trace'
import {
  getDefaultImportProtectionRules,
  getMarkerSpecifiers,
} from '../../import-protection/defaults'
import { compileMatchers, matchesAny } from '../../import-protection/matchers'
import {
  getImportProtectionEnvType,
  getImportProtectionRelativePath,
  getImportProtectionRulesForEnvironment,
  shouldCheckImportProtectionImporter,
} from '../../import-protection/adapterUtils'
import {
  buildResolutionCandidates,
  buildSourceCandidates,
  canonicalizeResolvedId,
  checkFileDenial,
  clearNormalizeFilePathCache,
  debugLog,
  dedupePatterns,
  dedupeViolationKey,
  getOrCreate,
  isFileExcluded,
  isInsideDirectory,
  matchesDebugFilter,
  normalizeFilePath,
  relativizePath,
  shouldDeferViolation,
} from '../../import-protection/utils'
import {
  getImportSourcesFromResult,
  getMockExportNamesBySource,
  getNamedExports,
} from '../../import-protection/analysis'
import { rewriteDeniedImports } from '../../import-protection/rewrite'
import { ExtensionlessAbsoluteIdResolver } from '../../import-protection/extensionlessAbsoluteIdResolver'
import {
  IMPORT_PROTECTION_DEBUG,
  SERVER_FN_LOOKUP_QUERY,
  VITE_BROWSER_VIRTUAL_PREFIX,
} from '../../import-protection/constants'
import {
  ImportLocCache,
  addTraceImportLocations,
  buildCodeSnippet,
  createImportSpecifierLocationIndex,
  findImportStatementLocationFromTransformed,
  findOriginalUsageLocation,
  findPostCompileUsageLocation,
  normalizeSourceMap,
} from '../../import-protection/sourceLocation'
import {
  MOCK_BUILD_PREFIX,
  generateDevSelfDenialModule,
  generateSelfContainedMockModule,
  getResolvedVirtualModuleMatchers,
  loadResolvedVirtualModule,
  makeMockEdgeModuleId,
  mockRuntimeModuleIdFromViolation,
  resolveInternalVirtualModuleId,
  resolvedMarkerVirtualModuleId,
} from './virtualModules'
import type { PluginOption, ViteDevServer } from 'vite'
import type {
  Loc,
  TraceStep,
  ViolationInfo,
} from '../../import-protection/trace'
import type {
  SourceMapLike,
  TransformResult,
  TransformResultProvider,
} from '../../import-protection/sourceLocation'
import type { ImportProtectionOptions } from '../../schema'
import type {
  EnvRules,
  EnvState,
  HandleViolationResult,
  ImportProtectionPluginOptions,
  ModuleGraphNode,
  PendingViolation,
  PluginConfig,
  SharedState,
  ViolationReporter,
} from './types'

export type { ImportProtectionPluginOptions } from './types'

type PerfTiming = {
  count: number
  totalMs: number
  maxMs: number
}

type PerfCollector = {
  count: (name: string, value?: number) => void
  time: (name: string, startedAt: number) => void
  flush: (root: string, envName: string) => void
}

function isPerfEnabled(): boolean {
  return (
    process.env.TSR_IMPORT_PROTECTION_PERF === '1' ||
    process.env.TSR_IMPORT_PROTECTION_PERF === 'true'
  )
}

function createPerfCollector(): PerfCollector {
  const counters = new Map<string, number>()
  const timings = new Map<string, PerfTiming>()
  const flushEnvironments = new Set<string>()
  let flushCount = 0

  return {
    count(name, value = 1) {
      counters.set(name, (counters.get(name) ?? 0) + value)
    },
    time(name, startedAt) {
      const duration = performance.now() - startedAt
      const timing = timings.get(name)
      if (timing) {
        timing.count++
        timing.totalMs += duration
        timing.maxMs = Math.max(timing.maxMs, duration)
      } else {
        timings.set(name, { count: 1, totalMs: duration, maxMs: duration })
      }
    },
    flush(root, envName) {
      flushCount++
      flushEnvironments.add(envName)

      const payload = {
        root,
        flushCount,
        flushEnvironments: Array.from(flushEnvironments).sort(),
        counters: Object.fromEntries(counters),
        timings: Object.fromEntries(
          Array.from(timings, ([name, timing]) => [
            name,
            {
              count: timing.count,
              totalMs: Number(timing.totalMs.toFixed(3)),
              avgMs: Number((timing.totalMs / timing.count).toFixed(3)),
              maxMs: Number(timing.maxMs.toFixed(3)),
            },
          ]),
        ),
      }

      const file = process.env.TSR_IMPORT_PROTECTION_PERF_FILE
      if (file) {
        writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`)
      } else {
        console.warn(
          `[import-protection:perf] ${JSON.stringify(payload, null, 2)}`,
        )
      }
    },
  }
}

export function importProtectionPlugin(
  opts: ImportProtectionPluginOptions,
): PluginOption {
  let devServer: ViteDevServer | null = null
  const perf = isPerfEnabled() ? createPerfCollector() : undefined
  const extensionlessIdResolver = new ExtensionlessAbsoluteIdResolver()
  const resolveExtensionlessAbsoluteId = (id: string) =>
    extensionlessIdResolver.resolve(id)
  const importSpecifierLocationIndex = createImportSpecifierLocationIndex()

  /**
   * Build an import trace using Vite's per-environment module graph, which
   * is authoritative even on warm starts when the plugin's own ImportGraph
   * may be incomplete (Vite skips resolveId for cached modules).
   */
  function buildTraceFromModuleGraph(
    envName: string,
    env: EnvState,
    targetFile: string,
  ): Array<TraceStep> | null {
    if (!devServer) return null
    const environment = devServer.environments[envName]
    if (!environment) return null

    const file = normalizeFilePath(targetFile)
    const start = environment.moduleGraph.getModuleById(file)
    if (!start) return null

    // Resolve a module graph node to its normalized file path once and
    // cache the result so BFS + reconstruction don't recompute.
    const nodeIds = new Map<ModuleGraphNode, string>()
    function nodeId(n: ModuleGraphNode): string {
      let cached = nodeIds.get(n)
      if (cached === undefined) {
        cached = n.id
          ? normalizeFilePath(n.id)
          : n.url
            ? normalizeFilePath(n.url)
            : ''
        nodeIds.set(n, cached)
      }
      return cached
    }

    const queue: Array<ModuleGraphNode> = [start]
    const visited = new Set<ModuleGraphNode>([start])
    const parent = new Map<ModuleGraphNode, ModuleGraphNode>()

    let entryRoot: ModuleGraphNode | null = null
    let fallbackRoot: ModuleGraphNode | null = null
    let qi = 0
    while (qi < queue.length) {
      const node = queue[qi++]!
      const id = nodeId(node)

      if (id && env.graph.entries.has(id)) {
        entryRoot = node
        break
      }

      const importers = node.importers
      if (importers.size === 0) {
        if (!fallbackRoot) fallbackRoot = node
        continue
      }

      for (const imp of importers) {
        if (visited.has(imp)) continue
        visited.add(imp)
        parent.set(imp, node)
        queue.push(imp)
      }
    }

    const root = entryRoot ?? fallbackRoot

    if (!root) return null

    // Reconstruct: root -> ... -> start
    const chain: Array<ModuleGraphNode> = []
    let cur: ModuleGraphNode | undefined = root
    for (let i = 0; i < config.maxTraceDepth + 2 && cur; i++) {
      chain.push(cur)
      if (cur === start) break
      cur = parent.get(cur)
    }

    const steps: Array<TraceStep> = []
    for (let i = 0; i < chain.length; i++) {
      const id = nodeId(chain[i]!)
      if (!id) continue
      let specifier: string | undefined
      if (i + 1 < chain.length) {
        const nextId = nodeId(chain[i + 1]!)
        if (nextId) {
          specifier = env.graph.reverseEdges.get(nextId)?.get(id)
        }
      }
      steps.push(specifier ? { file: id, specifier } : { file: id })
    }

    return steps.length ? steps : null
  }

  const config: PluginConfig = {
    enabled: true,
    root: '',
    command: 'build',
    bundledDev: false,
    srcDirectory: '',
    framework: opts.framework,
    effectiveBehavior: 'error',
    mockAccess: 'error',
    logMode: 'once',
    maxTraceDepth: 20,
    compiledRules: {
      client: { specifiers: [], files: [], excludeFiles: [] },
      server: { specifiers: [], files: [], excludeFiles: [] },
    },
    includeMatchers: [],
    excludeMatchers: [],
    ignoreImporterMatchers: [],
    markerSpecifiers: { serverOnly: new Set(), clientOnly: new Set() },
    envTypeMap: new Map(opts.environments.map((e) => [e.name, e.type])),
    onViolation: undefined,
  }

  const envStates = new Map<string, EnvState>()
  const shared: SharedState = { fileMarkerKind: new Map() }

  function shouldCaptureDiagnosticSourceMap(
    code: string,
    envType: 'client' | 'server',
    matchers: EnvRules,
  ): boolean {
    const hasImportOrExport = code.includes('import') || code.includes('export')
    if (!hasImportOrExport) {
      return false
    }

    const boundaryToken = envType === 'client' ? '.server' : '.client'
    if (code.includes(boundaryToken)) {
      return true
    }

    for (const marker of config.markerSpecifiers.serverOnly) {
      if (code.includes(marker)) {
        return true
      }
    }
    for (const marker of config.markerSpecifiers.clientOnly) {
      if (code.includes(marker)) {
        return true
      }
    }

    let needsSourceScan = false
    for (const matcher of matchers.specifiers) {
      if (matcher.literal !== undefined) {
        if (code.includes(matcher.literal)) {
          return true
        }
        continue
      }

      needsSourceScan = true
    }

    for (const matcher of matchers.files) {
      if (
        matcher.pattern instanceof RegExp ||
        !matcher.pattern.includes(boundaryToken)
      ) {
        needsSourceScan = true
        break
      }
    }

    // Custom non-literal rules cannot be checked with safe substring tests.
    // Capture broadly for modules with import/export syntax rather than trying
    // to parse import source literals with a regex.
    return needsSourceScan
  }

  function captureDiagnosticSourceMap(
    result: TransformResult,
    getCombinedSourcemap: () => SourceMapLike | null | undefined,
    reason: string,
  ): void {
    if (result.map) {
      return
    }

    const startedAt = perf ? performance.now() : 0
    try {
      const map = getCombinedSourcemap()
      if (map) {
        result.map = map
        perf?.count(`sourcemap.captured.${reason}`)
      }
    } catch {
      perf?.count(`sourcemap.captureFailed.${reason}`)
    } finally {
      if (perf) {
        perf.time('sourcemap.capture', startedAt)
      }
    }
  }

  /**
   * Build the best available source trace for a module and enrich each step
   * with line/column locations.  The plugin's own ImportGraph is preferred;
   * Vite's moduleGraph is only a dev fallback for warm starts where Vite may
   * skip resolveId for cached modules.
   *
   * Shared by {@link buildViolationInfo} and {@link processPendingViolations}.
   */
  async function rebuildAndAnnotateTrace(
    provider: TransformResultProvider,
    env: EnvState,
    envName: string,
    normalizedImporter: string,
    specifier: string,
    importerLoc: Loc | undefined,
    traceOverride?: Array<TraceStep>,
  ): Promise<Array<TraceStep>> {
    let trace =
      traceOverride ??
      buildTrace(env.graph, normalizedImporter, config.maxTraceDepth)

    if (config.command === 'serve') {
      const mgTrace = buildTraceFromModuleGraph(
        envName,
        env,
        normalizedImporter,
      )
      if (mgTrace && mgTrace.length > trace.length) {
        trace = mgTrace
      }
    }
    await addTraceImportLocations(
      provider,
      trace,
      env.importLocCache,
      importSpecifierLocationIndex.find,
    )

    if (trace.length > 0) {
      const last = trace[trace.length - 1]!
      if (!last.specifier) last.specifier = specifier
      if (importerLoc && last.line == null) {
        last.line = importerLoc.line
        last.column = importerLoc.column
      }
    }

    return trace
  }

  /**
   * Build a lightweight {@link ViolationInfo} record.
   *
   * Diagnostic-only work (trace, source-map lookup, snippets, AST usage
   * analysis) is intentionally deferred until the violation is about to be
   * reported.
   */
  function buildViolationInfo(
    envName: string,
    envType: 'client' | 'server',
    normalizedImporter: string,
    source: string,
    overrides: Omit<
      ViolationInfo,
      | 'env'
      | 'envType'
      | 'behavior'
      | 'specifier'
      | 'importer'
      | 'trace'
      | 'snippet'
      | 'importerLoc'
    >,
    traceOverride?: Array<TraceStep>,
  ): ViolationInfo {
    perf?.count('violations.detected')
    return {
      env: envName,
      envType,
      behavior: config.effectiveBehavior,
      specifier: source,
      importer: normalizedImporter,
      trace: traceOverride ?? [],
      ...overrides,
    }
  }

  async function enrichViolationInfo(
    provider: TransformResultProvider,
    env: EnvState,
    envName: string,
    envType: 'client' | 'server',
    importer: string,
    info: ViolationInfo,
    traceOverride?: Array<TraceStep>,
  ): Promise<void> {
    const startedAt = perf ? performance.now() : 0
    perf?.count('violations.enriched')

    const resolved = info.resolved
    const sourceCandidates = buildSourceCandidates(
      info.specifier,
      resolved,
      config.root,
    )
    addImporterRelativeSourceCandidates(sourceCandidates, importer, resolved)

    if (!info.importerLoc) {
      const loc = await resolveImporterLocation(
        provider,
        env,
        envType,
        importer,
        sourceCandidates,
      )
      if (loc) {
        info.importerLoc = loc
        info.snippet = buildCodeSnippet(
          provider,
          importer,
          loc,
          undefined,
          config.root,
        )
      }
    } else if (!info.snippet) {
      info.snippet = buildCodeSnippet(
        provider,
        importer,
        info.importerLoc,
        undefined,
        config.root,
      )
    }

    if (traceOverride || info.trace.length === 0) {
      info.trace = await rebuildAndAnnotateTrace(
        provider,
        env,
        envName,
        info.importer,
        info.specifier,
        info.importerLoc,
        traceOverride,
      )
    }

    if (perf) {
      perf.time('violation.enrich', startedAt)
    }
  }

  async function resolveImporterLocation(
    provider: TransformResultProvider,
    env: EnvState,
    envType: 'client' | 'server',
    importer: string,
    sourceCandidates: Iterable<string>,
  ): Promise<Loc | undefined> {
    for (const candidate of sourceCandidates) {
      const loc =
        (await findPostCompileUsageLocation(provider, importer, candidate)) ||
        findOriginalUsageLocation(
          provider,
          importer,
          candidate,
          envType,
          config.root,
        ) ||
        (await findImportStatementLocationFromTransformed(
          provider,
          importer,
          candidate,
          env.importLocCache,
          importSpecifierLocationIndex.find,
        ))
      if (loc) return loc
    }
    return undefined
  }

  function addImporterRelativeSourceCandidates(
    candidates: Set<string>,
    importer: string,
    resolved: string | undefined,
  ): void {
    if (!resolved) {
      return
    }

    const importerFile = normalizeFilePath(importer)
    const resolvedFile = normalizeFilePath(resolved)
    const relativeSource = normalizePath(
      relative(dirname(importerFile), resolvedFile),
    )

    if (!relativeSource) {
      return
    }

    const importSource = relativeSource.startsWith('.')
      ? relativeSource
      : `./${relativeSource}`

    for (const candidate of buildSourceCandidates(
      importSource,
      undefined,
      config.root,
    )) {
      candidates.add(candidate)
    }
  }

  /**
   * Check if a resolved import violates marker restrictions (e.g. importing
   * a server-only module in the client env).  If so, build and return the
   * {@link ViolationInfo} — the caller is responsible for reporting/deferring.
   *
   * Returns `undefined` when the resolved import has no marker conflict.
   */
  function buildMarkerViolationFromResolvedImport(
    envName: string,
    envType: 'client' | 'server',
    importer: string,
    source: string,
    resolvedId: string,
    traceOverride?: Array<TraceStep>,
  ): ViolationInfo | undefined {
    const normalizedResolvedId = normalizeFilePath(resolvedId)
    const markerKind = shared.fileMarkerKind.get(normalizedResolvedId)
    const violates =
      (envType === 'client' && markerKind === 'server') ||
      (envType === 'server' && markerKind === 'client')
    if (!violates) return undefined

    const normalizedImporter = normalizeFilePath(importer)

    return buildViolationInfo(
      envName,
      envType,
      normalizedImporter,
      source,
      {
        type: 'marker',
        resolved: normalizedResolvedId,
      },
      traceOverride,
    )
  }

  function buildFileViolationInfo(
    envName: string,
    envType: 'client' | 'server',
    normalizedImporter: string,
    source: string,
    resolvedPath: string,
    pattern: string | RegExp,
    traceOverride?: Array<TraceStep>,
  ): ViolationInfo {
    return buildViolationInfo(
      envName,
      envType,
      normalizedImporter,
      source,
      {
        type: 'file',
        pattern,
        resolved: resolvedPath,
      },
      traceOverride,
    )
  }

  function getRulesForEnvironment(envName: string): EnvRules {
    return getImportProtectionRulesForEnvironment(config, envName) as EnvRules
  }

  const environmentNames = new Set<string>([
    VITE_ENVIRONMENT_NAMES.client,
    VITE_ENVIRONMENT_NAMES.server,
  ])
  if (opts.providerEnvName !== VITE_ENVIRONMENT_NAMES.server) {
    environmentNames.add(opts.providerEnvName)
  }

  /** Get (or lazily create) the per-env state for the given environment name. */
  function getEnv(envName: string): EnvState {
    let envState = envStates.get(envName)
    if (!envState) {
      const transformResultCache = new Map<string, TransformResult>()
      envState = {
        graph: new ImportGraph(),
        mockExportsByImporter: new Map(),
        resolveCache: new Map(),
        resolveCacheByFile: new Map(),
        importLocCache: new ImportLocCache(),
        seenViolations: new Set(),
        transformResultCache,
        transformResultKeysByFile: new Map(),
        transformResultProvider: {
          getTransformResult(id: string) {
            const fullKey = normalizePath(id)
            const exact = transformResultCache.get(fullKey)
            if (exact) return exact
            const strippedKey = normalizeFilePath(id)
            return strippedKey !== fullKey
              ? transformResultCache.get(strippedKey)
              : undefined
          },
        },
        postTransformImports: new Map(),
        serverFnLookupModules: new Set(),
        pendingViolations: new Map(),
        deferredBuildViolations: [],
      }
      envStates.set(envName, envState)
    }
    return envState
  }

  /**
   * Search a parsed export-names map for an entry matching any of the
   * specifier candidates.  Returns matching names or empty array.
   */
  function findExportsInMap(
    exportMap: Map<string, Array<string>>,
    candidates: Array<string>,
  ): Array<string> {
    for (const candidate of candidates) {
      const hit = exportMap.get(candidate)
      if (hit && hit.length > 0) return hit
    }
    return []
  }

  /**
   * Build deduped resolution candidates for a module ID, including the
   * extensionless absolute path when the ID looks like a file path.
   */
  function buildIdCandidates(id: string, extra?: string): Array<string> {
    const set = new Set(buildResolutionCandidates(id))
    if (extra) {
      for (const c of buildResolutionCandidates(extra)) set.add(c)
      set.add(resolveExtensionlessAbsoluteId(extra))
    }
    return Array.from(set)
  }

  /**
   * Resolve which named exports the importer needs from a denied specifier,
   * so mock-edge modules can provide explicit ESM named exports.
   *
   * Tries multiple strategies: cached export maps, AST parsing, and
   * resolver-based comparison.
   */
  async function resolveExportsForDeniedSpecifier(
    env: EnvState,
    ctx: ViolationReporter,
    info: ViolationInfo,
    importerIdHint?: string,
  ): Promise<Array<string>> {
    const importerFile = normalizeFilePath(info.importer)
    const specifierCandidates = buildIdCandidates(info.specifier, info.resolved)

    // Only parse AST when a violation occurs (this function is only called
    // while handling a violation). Cache per-importer to avoid repeated parses
    // across multiple violations.
    let parsedBySource = env.mockExportsByImporter.get(importerFile)
    if (!parsedBySource) {
      // Try transform-cache result first, then moduleInfo fallback.
      const importerCode =
        env.transformResultProvider.getTransformResult(importerFile)?.code ??
        (importerIdHint && ctx.getModuleInfo
          ? (ctx.getModuleInfo(importerIdHint)?.code ?? undefined)
          : undefined)
      if (typeof importerCode !== 'string' || importerCode.length === 0)
        return []

      try {
        parsedBySource = getMockExportNamesBySource(
          importerCode,
          importerFile,
          perf,
        )

        // Also index by resolved physical IDs so later lookups match.
        await recordMockExportsForImporter(
          env,
          importerFile,
          parsedBySource,
          async (src) => {
            const cacheKey = `${importerFile}:${src}`
            if (env.resolveCache.has(cacheKey)) {
              return env.resolveCache.get(cacheKey) ?? undefined
            }
            if (!ctx.resolve) return undefined
            const resolved = await ctx.resolve(src, info.importer, {
              skipSelf: true,
            })
            if (!resolved || resolved.external) return undefined
            return resolved.id
          },
        )

        // Keep the parsed-by-source map for direct lookups.
        parsedBySource =
          env.mockExportsByImporter.get(importerFile) ?? parsedBySource
      } catch {
        return []
      }
    }

    // 1. Direct candidate match
    const direct = findExportsInMap(parsedBySource, specifierCandidates)
    if (direct.length > 0) return direct

    // 2. Resolve each source key and compare candidates.
    const candidateSet = new Set(specifierCandidates)
    for (const [sourceKey, names] of parsedBySource) {
      if (!names.length) continue

      const resolvedId = await resolveSourceKey(
        env,
        ctx,
        importerFile,
        sourceKey,
        info.importer,
      )
      if (!resolvedId) continue

      const resolvedCandidates = buildIdCandidates(resolvedId)
      resolvedCandidates.push(resolveExtensionlessAbsoluteId(resolvedId))
      if (resolvedCandidates.some((v) => candidateSet.has(v))) {
        return names
      }
    }

    return []
  }

  /** Best-effort resolve a source key using the cache or ctx.resolve. */
  async function resolveSourceKey(
    env: EnvState,
    ctx: ViolationReporter,
    importerFile: string,
    sourceKey: string,
    importerId: string,
  ): Promise<string | undefined> {
    const cacheKey = `${importerFile}:${sourceKey}`
    if (env.resolveCache.has(cacheKey)) {
      return env.resolveCache.get(cacheKey) ?? undefined
    }
    if (!ctx.resolve) return undefined
    try {
      const resolved = await ctx.resolve(sourceKey, importerId, {
        skipSelf: true,
      })
      if (!resolved || resolved.external) return undefined
      return resolved.id
    } catch {
      return undefined
    }
  }

  async function recordMockExportsForImporter(
    env: EnvState,
    importerId: string,
    namesBySource: Map<string, Array<string>>,
    resolveSource: (source: string) => Promise<string | undefined>,
  ): Promise<void> {
    const importerFile = normalizeFilePath(importerId)

    if (namesBySource.size === 0) return

    const resolvedAliases = new Map<string, Array<string>>()
    for (const [source, names] of namesBySource) {
      try {
        const resolvedId = await resolveSource(source)
        if (!resolvedId) continue

        resolvedAliases.set(normalizeFilePath(resolvedId), names)
        resolvedAliases.set(resolveExtensionlessAbsoluteId(resolvedId), names)
      } catch {
        // Best-effort only
      }
    }

    for (const [source, names] of resolvedAliases) {
      namesBySource.set(source, names)
    }

    const existing = env.mockExportsByImporter.get(importerFile)
    if (!existing) {
      env.mockExportsByImporter.set(importerFile, namesBySource)
      return
    }

    for (const [source, names] of namesBySource) {
      const prev = existing.get(source)
      if (!prev) {
        existing.set(source, names)
        continue
      }

      const union = new Set([...prev, ...names])
      existing.set(source, Array.from(union).sort())
    }
  }

  const shouldCheckImporterCache = new Map<string, boolean>()
  function shouldCheckImporter(importer: string): boolean {
    return shouldCheckImportProtectionImporter(
      config,
      importer,
      shouldCheckImporterCache,
    )
  }

  function dedupeKey(info: ViolationInfo): string {
    return dedupeViolationKey(info)
  }

  function hasSeen(env: EnvState, key: string): boolean {
    if (config.logMode === 'always') return false
    if (env.seenViolations.has(key)) return true
    env.seenViolations.add(key)
    return false
  }

  function getRelativePath(absolutePath: string): string {
    return getImportProtectionRelativePath(config.root, absolutePath)
  }

  /** Reset all caches on an EnvState (called from buildStart). */
  function clearEnvState(envState: EnvState): void {
    envState.resolveCache.clear()
    envState.resolveCacheByFile.clear()
    envState.importLocCache.clear()
    envState.seenViolations.clear()
    envState.transformResultCache.clear()
    envState.transformResultKeysByFile.clear()
    envState.postTransformImports.clear()
    envState.serverFnLookupModules.clear()
    envState.pendingViolations.clear()
    envState.deferredBuildViolations.length = 0
    envState.graph.clear()
    envState.mockExportsByImporter.clear()
  }

  /** Invalidate all env-level caches that reference a specific file. */
  function invalidateFileFromEnv(envState: EnvState, file: string): void {
    envState.importLocCache.deleteByFile(file)

    // Resolve cache (keyed "importer:source")
    const resolveKeys = envState.resolveCacheByFile.get(file)
    if (resolveKeys) {
      for (const key of resolveKeys) envState.resolveCache.delete(key)
      envState.resolveCacheByFile.delete(file)
    }

    envState.graph.invalidate(file)
    envState.mockExportsByImporter.delete(file)
    envState.serverFnLookupModules.delete(file)
    envState.pendingViolations.delete(file)

    // Transform result cache + post-transform imports
    const transformKeys = envState.transformResultKeysByFile.get(file)
    if (transformKeys) {
      for (const key of transformKeys) {
        envState.transformResultCache.delete(key)
        envState.postTransformImports.delete(key)
      }
      envState.transformResultKeysByFile.delete(file)
    } else {
      envState.transformResultCache.delete(file)
      envState.postTransformImports.delete(file)
    }
  }

  /** Store a transform result under both the cacheKey and physical file path. */
  function cacheTransformResult(
    envState: EnvState,
    file: string,
    cacheKey: string,
    result: TransformResult,
  ): void {
    envState.transformResultCache.set(cacheKey, result)
    const keySet = getOrCreate(
      envState.transformResultKeysByFile,
      file,
      () => new Set<string>(),
    )
    keySet.add(cacheKey)
    if (cacheKey !== file) {
      envState.transformResultCache.set(file, result)
      keySet.add(file)
    }
  }

  /** Register known Start entrypoints as trace roots for all environments. */
  function registerEntries(): void {
    const { resolvedStartConfig } = opts.getConfig()
    for (const envDef of opts.environments) {
      const envState = getEnv(envDef.name)
      if (resolvedStartConfig.routerFilePath) {
        envState.graph.addEntry(
          normalizePath(resolvedStartConfig.routerFilePath),
        )
      }
      if (resolvedStartConfig.startFilePath) {
        envState.graph.addEntry(
          normalizePath(resolvedStartConfig.startFilePath),
        )
      }
    }
  }

  /**
   * Get the merged set of post-transform imports for a file, checking all
   * code-split variants.  Returns `null` if no post-transform data exists
   * yet (transform hasn't run).
   *
   * Skips `SERVER_FN_LOOKUP` variants because they contain untransformed
   * code — the Start compiler excludes them.
   */
  function getPostTransformImports(
    env: EnvState,
    file: string,
  ): Set<string> | null {
    const keySet = env.transformResultKeysByFile.get(file)
    let merged: Set<string> | null = null

    if (keySet) {
      for (const k of keySet) {
        if (k.includes(SERVER_FN_LOOKUP_QUERY)) continue
        const imports = env.postTransformImports.get(k)
        if (imports) {
          if (!merged) merged = new Set(imports)
          else for (const v of imports) merged.add(v)
        }
      }
    }

    // Fallback: direct file-path key
    if (!merged) {
      const imports = env.postTransformImports.get(file)
      if (imports) merged = new Set(imports)
    }

    return merged
  }

  /**
   * Check whether an import edge from `parent` to `target` survived
   * post-transform compilation.
   *
   * Returns:
   *   - `'live'`    — target appears in a non-lookup variant's post-transform imports
   *   - `'dead'`    — post-transform data exists but target is absent (compiler stripped it)
   *   - `'pending'` — transform ran but import data not yet posted
   *   - `'no-data'` — transform never ran (warm-start cached module)
   */
  function checkEdgeLiveness(
    env: EnvState,
    parent: string,
    target: string,
  ): 'live' | 'dead' | 'pending' | 'no-data' {
    const keySet = env.transformResultKeysByFile.get(parent)
    let anyVariantCached = false

    if (keySet) {
      for (const k of keySet) {
        if (k.includes(SERVER_FN_LOOKUP_QUERY)) continue
        const imports = env.postTransformImports.get(k)
        if (imports) {
          anyVariantCached = true
          if (imports.has(target)) return 'live'
        }
      }
    }

    if (!anyVariantCached) {
      const imports = env.postTransformImports.get(parent)
      if (imports) return imports.has(target) ? 'live' : 'dead'
      const hasTransformResult =
        env.transformResultCache.has(parent) ||
        (keySet ? keySet.size > 0 : false)
      return hasTransformResult ? 'pending' : 'no-data'
    }

    return 'dead'
  }

  function checkPostTransformReachability(
    env: EnvState,
    file: string,
  ): 'reachable' | 'unreachable' | 'unknown' {
    const visited = new Set<string>()
    const queue: Array<string> = [file]
    let hasUnknownEdge = false
    let qi = 0

    while (qi < queue.length) {
      const current = queue[qi++]!
      if (visited.has(current)) {
        continue
      }
      visited.add(current)

      if (env.graph.entries.has(current)) {
        return 'reachable'
      }

      const importers = env.graph.reverseEdges.get(current)
      if (!importers) continue

      for (const [parent] of importers) {
        if (visited.has(parent)) continue
        const liveness = checkEdgeLiveness(env, parent, current)
        if (liveness === 'live' || liveness === 'no-data') {
          // Live edge or warm-start (no transform data) — follow it
          queue.push(parent)
        } else if (liveness === 'pending') {
          hasUnknownEdge = true
        }
        // 'dead' — edge was stripped by compiler, skip
      }
    }

    return hasUnknownEdge ? 'unknown' : 'unreachable'
  }

  function checkSourceGraphReachability(
    env: EnvState,
    file: string,
  ): 'reachable' | 'unreachable' {
    const visited = new Set<string>()
    const queue: Array<string> = [file]
    let qi = 0

    while (qi < queue.length) {
      const current = queue[qi++]!
      if (visited.has(current)) {
        continue
      }
      visited.add(current)

      if (env.graph.entries.has(current)) {
        return 'reachable'
      }

      const importers = env.graph.reverseEdges.get(current)
      if (!importers) {
        continue
      }

      if (importers.size === 0) {
        const routesDirectory = normalizePath(`${config.srcDirectory}/routes`)
        if (current === file || isInsideDirectory(current, routesDirectory)) {
          return 'reachable'
        }
        continue
      }

      for (const [parent] of importers) {
        if (!visited.has(parent)) {
          queue.push(parent)
        }
      }
    }

    return 'unreachable'
  }

  /**
   * Filter pending violations using edge-survival data.  Returns the subset
   * of violations whose resolved import survived the Start compiler (or all
   * violations when no post-transform data is available yet).
   *
   * Returns `undefined` when all violations were stripped or when we must wait
   * for post-transform data before proceeding.
   */
  function filterEdgeSurvival(
    env: EnvState,
    file: string,
    violations: Array<PendingViolation>,
  ):
    | { active: Array<PendingViolation>; edgeSurvivalApplied: boolean }
    | 'all-stripped'
    | 'await-transform' {
    const postTransform = getPostTransformImports(env, file)

    if (postTransform) {
      const surviving = violations.filter(
        (pv) => !pv.info.resolved || postTransform.has(pv.info.resolved),
      )
      if (surviving.length === 0) return 'all-stripped'
      env.pendingViolations.set(file, surviving)
      return { active: surviving, edgeSurvivalApplied: true }
    }

    // Pre-transform violations need edge-survival verification first.
    if (violations.some((pv) => pv.fromPreTransformResolve)) {
      return 'await-transform'
    }

    return { active: violations, edgeSurvivalApplied: false }
  }

  /**
   * Process pending violations for the given environment.  Called from the
   * transform-cache hook after each module transform is cached, because new
   * transform data may allow us to confirm or discard pending violations.
   *
   * @param warnFn - `this.warn` from the transform hook context
   */
  async function processPendingViolations(
    env: EnvState,
    warnFn: (msg: string) => void,
  ): Promise<void> {
    if (env.pendingViolations.size === 0) return

    const toDelete: Array<string> = []

    for (const [file, violations] of env.pendingViolations) {
      const filtered = filterEdgeSurvival(env, file, violations)

      if (filtered === 'all-stripped') {
        toDelete.push(file)
        continue
      }
      if (filtered === 'await-transform') continue

      const { active, edgeSurvivalApplied } = filtered
      const isBundledClientDev =
        config.command === 'serve' &&
        config.bundledDev &&
        active.some((pv) => pv.info.envType === 'client')
      // Wait for entries before running reachability.  registerEntries()
      // populates entries at buildStart; resolveId(!importer) may add more.
      let status: 'reachable' | 'unreachable' | 'unknown'
      if (isBundledClientDev && edgeSurvivalApplied) {
        status = checkSourceGraphReachability(env, file)
      } else if (env.graph.entries.size > 0) {
        status = checkPostTransformReachability(env, file)
      } else {
        status = 'unknown'
      }

      if (status === 'reachable') {
        for (const pv of active) {
          await emitPendingViolation(env, warnFn, pv)
        }
        toDelete.push(file)
      } else if (status === 'unreachable') {
        if (isBundledClientDev) {
          // Bundled dev can transform a child before its route/importer has
          // recorded the source edge.  Keep confirmed-surviving violations
          // pending until a real source importer makes them reachable.
          continue
        }
        toDelete.push(file)
      } else if (config.command === 'serve') {
        // 'unknown' reachability — some graph edges lack transform data.
        // When edge-survival was applied, surviving violations are confirmed
        // real.  Without it (warm start), emit conservatively.
        let emittedAny = false
        for (const pv of active) {
          if (pv.fromPreTransformResolve) continue

          const shouldEmit =
            edgeSurvivalApplied ||
            (pv.info.type === 'file' &&
              !!pv.info.resolved &&
              isInsideDirectory(pv.info.resolved, config.srcDirectory))

          if (shouldEmit) {
            emittedAny =
              (await emitPendingViolation(env, warnFn, pv)) || emittedAny
          }
        }

        if (emittedAny) {
          toDelete.push(file)
        }
      }
      // 'unknown' — keep pending for next transform-cache invocation.
    }

    for (const file of toDelete) {
      env.pendingViolations.delete(file)
    }
  }

  async function emitPendingViolation(
    env: EnvState,
    warnFn: (msg: string) => void,
    pv: PendingViolation,
  ): Promise<boolean> {
    if (hasSeen(env, dedupeKey(pv.info))) {
      return false
    }

    await enrichViolationInfo(
      env.transformResultProvider,
      env,
      pv.info.env,
      pv.info.envType,
      pv.info.importer,
      pv.info,
    )

    if (config.onViolation) {
      const result = await config.onViolation(pv.info)
      if (result === false) return false
    }

    warnFn(formatViolation(pv.info, config.root))
    return true
  }

  /**
   * Record a violation as pending for later confirmation via graph
   * reachability.  Called from `resolveId` when `shouldDefer` is true.
   */
  function deferViolation(
    env: EnvState,
    importerFile: string,
    info: ViolationInfo,
    isPreTransformResolve?: boolean,
  ): void {
    getOrCreate(env.pendingViolations, importerFile, () => []).push({
      info,
      fromPreTransformResolve: isPreTransformResolve,
    })
  }

  /** Counter for generating unique per-violation mock module IDs in build mode. */
  let buildViolationCounter = 0

  async function handleViolation(
    ctx: ViolationReporter,
    env: EnvState,
    info: ViolationInfo,
    importerIdHint?: string,
    violationOpts?: { silent?: boolean },
  ): Promise<HandleViolationResult> {
    if (!violationOpts?.silent) {
      await enrichViolationInfo(
        env.transformResultProvider,
        env,
        info.env,
        info.envType,
        importerIdHint ?? info.importer,
        info,
      )

      if (config.onViolation) {
        const result = await config.onViolation(info)
        if (result === false) return undefined
      }

      if (config.effectiveBehavior === 'error') {
        // Dev+error: throw immediately.
        // Always throw on error — do NOT deduplicate via hasSeen().
        // Rollup may resolve the same specifier multiple times (e.g.
        // commonjs--resolver's nested this.resolve() fires before
        // getResolveStaticDependencyPromises). If we record the key
        // on the first (nested) throw, the second (real) resolve
        // silently returns undefined and the build succeeds — which
        // is the bug this fixes.
        //
        // Build mode never reaches here — all build violations are
        // deferred via shouldDefer and handled silently.
        return ctx.error(formatViolation(info, config.root))
      }

      if (!hasSeen(env, dedupeKey(info))) {
        ctx.warn(formatViolation(info, config.root))
      }
    } else if (
      config.effectiveBehavior === 'error' &&
      config.command !== 'build'
    ) {
      return undefined
    }

    // File violations: return resolved path — the self-denial transform
    // will replace the file's content with a mock module.  This avoids
    // virtual module IDs that could leak across environments via
    // third-party resolver caches.
    if (info.type === 'file') return info.resolved

    // Non-file violations (specifier/marker): create mock-edge module.
    // Dev mode uses a runtime diagnostics ID; build mode uses a unique
    // per-violation ID so generateBundle can check tree-shaking survival.
    const exports = await resolveExportsForDeniedSpecifier(
      env,
      ctx,
      info,
      importerIdHint,
    )
    const baseMockId =
      config.command === 'serve'
        ? mockRuntimeModuleIdFromViolation(info, config.mockAccess, config.root)
        : `${MOCK_BUILD_PREFIX}${buildViolationCounter++}`
    return resolveViteId(makeMockEdgeModuleId(exports, baseMockId))
  }

  /**
   * Unified violation dispatch: either defers or reports immediately.
   *
   * When `shouldDefer` is true (dev mock + build modes), calls
   * `handleViolation` silently to obtain the mock module ID, then stores
   * the violation for later verification:
   *   - Dev mock mode: all violations are deferred to `pendingViolations`
   *     for edge-survival and graph-reachability checking via
   *     `processPendingViolations`.
   *   - Build mode (mock + error): defers to `deferredBuildViolations` for
   *     tree-shaking verification in `generateBundle`.
   *
   * Otherwise reports immediately (dev error mode).  Pre-transform
   * resolves are silenced in error mode because they fire before the
   * compiler runs and there is no deferred verification path.
   *
   * Returns the mock module ID / resolve result from `handleViolation`.
   */
  async function reportOrDeferViolation(
    ctx: ViolationReporter,
    env: EnvState,
    importerFile: string,
    importerIdHint: string | undefined,
    info: ViolationInfo,
    shouldDefer: boolean,
    isPreTransformResolve: boolean,
  ): Promise<HandleViolationResult> {
    if (shouldDefer) {
      const result = await handleViolation(ctx, env, info, importerIdHint, {
        silent: true,
      })

      if (config.command === 'build') {
        // Build mode: store for generateBundle tree-shaking check.
        // The mock-edge module ID is returned as a plain string.
        const mockId = result ?? ''
        env.deferredBuildViolations.push({
          info,
          mockModuleId: mockId,
          // For marker violations, check importer survival instead of mock.
          checkModuleId: info.type === 'marker' ? info.importer : undefined,
        })
      } else {
        // Dev mock: store for graph-reachability check.
        deferViolation(env, importerFile, info, isPreTransformResolve)
        await processPendingViolations(env, ctx.warn.bind(ctx))
      }

      return result
    }

    // Non-deferred path: dev error mode only.
    // Pre-transform resolves are silenced because they fire before the
    // compiler runs — imports inside `.server()` callbacks haven't been
    // stripped yet and error mode has no deferred verification.
    return handleViolation(ctx, env, info, importerIdHint, {
      silent: isPreTransformResolve,
    })
  }

  return [
    {
      name: 'tanstack-start-core:import-protection',
      enforce: 'pre',

      applyToEnvironment(env) {
        if (!config.enabled) return false
        // Start's environments are named `client` and `ssr` (not `server`), plus
        // an optional serverFn provider environment (eg `rsc`) when configured.
        return environmentNames.has(env.name)
      },

      configResolved(viteConfig) {
        config.root = viteConfig.root
        config.command = viteConfig.command
        config.bundledDev = !!viteConfig.experimental.bundledDev

        const { startConfig, resolvedStartConfig } = opts.getConfig()
        config.srcDirectory = resolvedStartConfig.srcDirectory

        const userOpts: ImportProtectionOptions | undefined =
          startConfig.importProtection

        if (userOpts?.enabled === false) {
          config.enabled = false
          return
        }

        config.enabled = true

        const behavior = userOpts?.behavior
        if (typeof behavior === 'string') {
          config.effectiveBehavior = behavior
        } else {
          config.effectiveBehavior =
            viteConfig.command === 'serve'
              ? (behavior?.dev ?? 'mock')
              : (behavior?.build ?? 'error')
        }

        config.logMode = userOpts?.log ?? 'once'
        config.mockAccess = userOpts?.mockAccess ?? 'error'
        config.maxTraceDepth = userOpts?.maxTraceDepth ?? 20
        if (userOpts?.onViolation) {
          const fn = userOpts.onViolation
          config.onViolation = (info) => fn(info)
        }

        const defaults = getDefaultImportProtectionRules()
        // Use user-provided patterns when available, otherwise defaults.
        const pick = <T>(user: Array<T> | undefined, fallback: Array<T>) =>
          user ? [...user] : [...fallback]

        // Client specifier denies always include framework defaults even
        // when the user provides a custom list.
        const clientSpecifiers = dedupePatterns([
          ...defaults.client.specifiers,
          ...(userOpts?.client?.specifiers ?? []),
        ])

        config.compiledRules.client = {
          specifiers: compileMatchers(clientSpecifiers),
          files: compileMatchers(
            pick(userOpts?.client?.files, defaults.client.files),
          ),
          excludeFiles: compileMatchers(
            pick(userOpts?.client?.excludeFiles, defaults.client.excludeFiles),
          ),
        }
        config.compiledRules.server = {
          specifiers: compileMatchers(
            dedupePatterns(
              pick(userOpts?.server?.specifiers, defaults.server.specifiers),
            ),
          ),
          files: compileMatchers(
            pick(userOpts?.server?.files, defaults.server.files),
          ),
          excludeFiles: compileMatchers(
            pick(userOpts?.server?.excludeFiles, defaults.server.excludeFiles),
          ),
        }

        config.includeMatchers = compileMatchers(userOpts?.include ?? [])
        config.excludeMatchers = compileMatchers(userOpts?.exclude ?? [])
        config.ignoreImporterMatchers = compileMatchers(
          userOpts?.ignoreImporters ?? [],
        )

        // Marker specifiers
        const markers = getMarkerSpecifiers()
        config.markerSpecifiers = {
          serverOnly: new Set(markers.serverOnly),
          clientOnly: new Set(markers.clientOnly),
        }
      },

      configureServer(server) {
        devServer = server
      },

      buildStart() {
        if (!config.enabled) return
        // Clear memoization caches that grow unboundedly across builds
        clearNormalizeFilePathCache()
        extensionlessIdResolver.clear()
        shouldCheckImporterCache.clear()

        // Clear per-env caches
        for (const envState of envStates.values()) {
          clearEnvState(envState)
        }

        // Clear shared state
        shared.fileMarkerKind.clear()

        registerEntries()
      },

      hotUpdate(ctx) {
        if (!config.enabled) return
        // Invalidate caches for updated files
        for (const mod of ctx.modules) {
          if (mod.id) {
            const id = mod.id
            const importerFile = normalizeFilePath(id)

            // Invalidate extensionless-resolution cache entries affected by this file.
            extensionlessIdResolver.invalidateByFile(importerFile)
            shared.fileMarkerKind.delete(importerFile)

            // Invalidate per-env caches
            for (const envState of envStates.values()) {
              invalidateFileFromEnv(envState, importerFile)
            }
          }
        }
      },

      resolveId: {
        filter: {
          id: {
            exclude: [
              /^\0(?!tanstack-start-import-protection:)/,
              /^virtual:(?!tanstack-start-import-protection:)/,
            ],
          },
        },
        async handler(source, importer, _options) {
          perf?.count('resolveId.calls')
          const envName = this.environment.name
          const env = getEnv(envName)
          const envType = getImportProtectionEnvType(config, envName)
          const isScanResolve = !!(_options as Record<string, unknown>).scan

          if (IMPORT_PROTECTION_DEBUG) {
            const importerPath = importer
              ? normalizeFilePath(importer)
              : '(entry)'
            const isEntryResolve = !importer
            const filtered =
              process.env.TSR_IMPORT_PROTECTION_DEBUG_FILTER === 'entry'
                ? isEntryResolve
                : matchesDebugFilter(source, importerPath)
            if (filtered) {
              debugLog('resolveId', {
                env: envName,
                envType,
                source,
                importer: importerPath,
                isEntryResolve,
                command: config.command,
              })
            }
          }

          // Internal virtual modules (mock:build:N, mock-edge, mock-runtime, marker)
          const internalVirtualId = resolveInternalVirtualModuleId(source)
          if (internalVirtualId) return internalVirtualId

          if (!importer) {
            const normalizedSource = normalizeFilePath(source)
            const isBundledClientSourceEntry =
              config.command === 'serve' &&
              config.bundledDev &&
              envType === 'client' &&
              isInsideDirectory(normalizedSource, config.srcDirectory)

            if (!isBundledClientSourceEntry) {
              env.graph.addEntry(source)
            }
            // Flush pending violations now that an additional entry is known
            // and reachability analysis may have new roots.
            await processPendingViolations(env, this.warn.bind(this))
            return undefined
          }

          if (source.startsWith('\0') || source.startsWith('virtual:')) {
            return undefined
          }

          const normalizedImporter = normalizeFilePath(importer)
          const isDirectLookup = importer.includes(SERVER_FN_LOOKUP_QUERY)
          const isBundledClientDev =
            config.command === 'serve' &&
            config.bundledDev &&
            envType === 'client'

          if (isBundledClientDev) {
            const routesDirectory = normalizePath(
              `${config.srcDirectory}/routes`,
            )
            if (isInsideDirectory(normalizedImporter, routesDirectory)) {
              env.graph.addEntry(normalizedImporter)
            }
          }

          if (isDirectLookup) {
            env.serverFnLookupModules.add(normalizedImporter)
          }

          const isServerFnPreTransformResolve =
            isDirectLookup || env.serverFnLookupModules.has(normalizedImporter)
          const isPreTransformResolve =
            isServerFnPreTransformResolve || isScanResolve
          const shouldRecordGraphEdge = !isServerFnPreTransformResolve

          // Dev mock mode: defer all violations (including pre-transform
          // resolves) until post-transform data is available, then
          // confirm/discard via graph reachability.
          // Build mode (both mock and error): defer violations until
          // generateBundle so tree-shaking can eliminate false positives.
          const isDevMock =
            config.command === 'serve' && config.effectiveBehavior === 'mock'
          const isBuild = config.command === 'build'
          const shouldDefer = shouldDeferViolation({ isBuild, isDevMock })

          type PluginResolveResult = NonNullable<
            Awaited<ReturnType<typeof this.resolve>>
          >

          const resolveAgainstImporter = async (): Promise<{
            id: string
            result: PluginResolveResult
          } | null> => {
            const startedAt = perf ? performance.now() : 0
            perf?.count('thisResolve.calls')
            let primary: PluginResolveResult | null = null
            try {
              const resolveOptions: Parameters<typeof this.resolve>[2] = {
                custom: _options.custom,
                isEntry: _options.isEntry,
                skipSelf: true,
              }
              if ('attributes' in _options) {
                const resolveOptionsWithAttributes =
                  resolveOptions as typeof resolveOptions & {
                    attributes?: unknown
                  }
                resolveOptionsWithAttributes.attributes = _options.attributes
              }
              primary = await this.resolve(source, importer, resolveOptions)
            } finally {
              if (perf) {
                perf.time('thisResolve', startedAt)
              }
            }
            if (primary) {
              return {
                id: canonicalizeResolvedId(
                  primary.id,
                  config.root,
                  resolveExtensionlessAbsoluteId,
                ),
                result: primary,
              }
            }

            return null
          }

          // Check if this is a marker import
          const markerKind = config.markerSpecifiers.serverOnly.has(source)
            ? ('server' as const)
            : config.markerSpecifiers.clientOnly.has(source)
              ? ('client' as const)
              : undefined

          if (markerKind) {
            const existing = shared.fileMarkerKind.get(normalizedImporter)
            if (existing && existing !== markerKind) {
              this.error(
                `[import-protection] File "${getRelativePath(normalizedImporter)}" has both server-only and client-only markers. This is not allowed.`,
              )
            }
            shared.fileMarkerKind.set(normalizedImporter, markerKind)

            const violatesEnv =
              (envType === 'client' && markerKind === 'server') ||
              (envType === 'server' && markerKind === 'client')

            if (violatesEnv) {
              const info = buildViolationInfo(
                envName,
                envType,
                normalizedImporter,
                source,
                {
                  type: 'marker',
                },
              )
              const markerResult = await reportOrDeferViolation(
                this,
                env,
                normalizedImporter,
                importer,
                info,
                shouldDefer,
                isPreTransformResolve,
              )

              // In build mode, if the violation was deferred, return the unique
              // build mock ID instead of the marker module. This lets
              // generateBundle check whether the importer (and thus its marker
              // import) survived tree-shaking. The mock is side-effect-free just
              // like the marker module, and the bare import has no bindings, so
              // replacing it is transparent.
              if (isBuild && markerResult != null) {
                return markerResult
              }
            }

            // Retroactive marker violation detection: on cold starts, module
            // A may import module B before B's marker is set (because B hasn't
            // been processed yet).  When B's marker is set (here),
            // retroactively check all known importers of B in the graph and
            // create deferred marker violations for them.  Without this,
            // cold-start ordering can miss marker violations that warm starts
            // detect (warm starts see markers early from cached transforms).
            //
            // Uses lightweight `deferViolation` to avoid heavy side effects
            // (mock module creation, export resolution).  Immediately calls
            // `processPendingViolations` to flush the deferred violations,
            // because the marker resolveId fires during Vite's import
            // analysis (after our transform hook) — there may be no
            // subsequent transform invocation to flush them.
            //
            // Guarded by `violatesEnv` (per-environment) plus a per-env
            // seen-set.  The marker is shared across environments but each
            // env's graph has its own edges; this ensures the check runs
            // at most once per (env, module) pair.
            const envRetroKey = `retro-marker:${normalizedImporter}`
            if (violatesEnv && !env.seenViolations.has(envRetroKey)) {
              env.seenViolations.add(envRetroKey)
              let retroDeferred = false
              const importersMap =
                env.graph.reverseEdges.get(normalizedImporter)
              if (importersMap && importersMap.size > 0) {
                for (const [importerFile, specifier] of importersMap) {
                  if (!specifier) continue
                  if (!shouldCheckImporter(importerFile)) continue
                  const markerInfo = buildMarkerViolationFromResolvedImport(
                    envName,
                    envType,
                    importerFile,
                    specifier,
                    normalizedImporter,
                  )
                  if (markerInfo) {
                    deferViolation(
                      env,
                      importerFile,
                      markerInfo,
                      isPreTransformResolve,
                    )
                    retroDeferred = true
                  }
                }
              }
              if (retroDeferred) {
                await processPendingViolations(env, this.warn.bind(this))
              }
            }

            return markerKind === 'server'
              ? resolvedMarkerVirtualModuleId('server')
              : resolvedMarkerVirtualModuleId('client')
          }

          // Check if the importer is within our scope
          if (!shouldCheckImporter(normalizedImporter)) {
            return undefined
          }

          const matchers = getRulesForEnvironment(envName)

          // 1. Specifier-based denial
          const specifierMatch = matchesAny(source, matchers.specifiers)
          if (specifierMatch) {
            if (shouldRecordGraphEdge) {
              env.graph.addEdge(source, normalizedImporter, source)
            }
            const info = buildViolationInfo(
              envName,
              envType,
              normalizedImporter,
              source,
              {
                type: 'specifier',
                pattern: specifierMatch.pattern,
              },
            )

            // Resolve the specifier so edge-survival can verify whether
            // the import survives the Start compiler transform (e.g.
            // factory-safe pattern strips imports inside .server() callbacks).
            if (shouldDefer && !info.resolved) {
              try {
                const resolvedForInfo = await resolveAgainstImporter()
                if (resolvedForInfo) {
                  info.resolved = resolvedForInfo.id
                }
              } catch {
                // Non-fatal: edge-survival will skip unresolved specifiers
              }
            }

            return reportOrDeferViolation(
              this,
              env,
              normalizedImporter,
              importer,
              info,
              shouldDefer,
              isPreTransformResolve,
            )
          }

          // 2. Resolve the import (cached)
          const cacheKey = `${normalizedImporter}:${source}`
          let resolved: string | null
          let passThroughResult: PluginResolveResult | null = null

          if (env.resolveCache.has(cacheKey)) {
            resolved = env.resolveCache.get(cacheKey) ?? null
          } else {
            const resolution = await resolveAgainstImporter()
            resolved = resolution?.id ?? null
            passThroughResult = resolution?.result ?? null

            // Only cache successful resolves.  Null resolves can be
            // order-dependent across importer variants (e.g. code-split
            // `?tsr-split=...` ids) and may poison later lookups.
            if (resolved !== null) {
              env.resolveCache.set(cacheKey, resolved)
              getOrCreate(
                env.resolveCacheByFile,
                normalizedImporter,
                () => new Set(),
              ).add(cacheKey)
            }
          }

          if (resolved) {
            const relativePath = getRelativePath(resolved)

            // Propagate pre-transform status transitively
            if (isServerFnPreTransformResolve) {
              env.serverFnLookupModules.add(resolved)
            }

            if (shouldRecordGraphEdge) {
              env.graph.addEdge(resolved, normalizedImporter, source)
            }

            // Skip file-based and marker-based denial for resolved paths that
            // match the per-environment `excludeFiles` patterns.  By default
            // this includes `**/node_modules/**` so that third-party packages
            // using `.client.` / `.server.` in their filenames (e.g. react-tweet
            // exports `index.client.js`) are not treated as user-authored
            // environment boundaries.  Users can override `excludeFiles` per
            // environment to narrow or widen this exclusion.
            const isExcludedFile = isFileExcluded(relativePath, matchers)

            if (!isExcludedFile) {
              const fileMatch = matchers.files.find((matcher) =>
                matcher.test(relativePath),
              )

              if (fileMatch) {
                const info = buildFileViolationInfo(
                  envName,
                  envType,
                  normalizedImporter,
                  source,
                  resolved,
                  fileMatch.pattern,
                )
                return reportOrDeferViolation(
                  this,
                  env,
                  normalizedImporter,
                  importer,
                  info,
                  shouldDefer,
                  isPreTransformResolve,
                )
              }

              const markerInfo = buildMarkerViolationFromResolvedImport(
                envName,
                envType,
                importer,
                source,
                resolved,
              )
              if (markerInfo) {
                return reportOrDeferViolation(
                  this,
                  env,
                  normalizedImporter,
                  importer,
                  markerInfo,
                  shouldDefer,
                  isPreTransformResolve,
                )
              }
            }

            if (passThroughResult) {
              return passThroughResult
            }
          }

          return undefined
        },
      },

      load: {
        filter: {
          id: new RegExp(
            getResolvedVirtualModuleMatchers().map(escapeRegExp).join('|'),
          ),
        },
        handler(id) {
          if (IMPORT_PROTECTION_DEBUG) {
            if (matchesDebugFilter(id)) {
              debugLog('load:handler', {
                env: this.environment.name,
                id: normalizePath(id),
              })
            }
          }

          return loadResolvedVirtualModule(id)
        },
      },

      async generateBundle(_options, bundle) {
        const envName = this.environment.name
        const env = envStates.get(envName)
        if (!env || env.deferredBuildViolations.length === 0) return

        const candidateCache = new Map<string, Array<string>>()
        const toModuleIdCandidates = (id: string): Array<string> => {
          let cached = candidateCache.get(id)
          if (cached) return cached

          const out = new Set<string>()
          const normalized = normalizeFilePath(id)
          out.add(id)
          out.add(normalized)
          out.add(relativizePath(normalized, config.root))

          if (normalized.startsWith(VITE_BROWSER_VIRTUAL_PREFIX)) {
            const internal = `\0${normalized.slice(VITE_BROWSER_VIRTUAL_PREFIX.length)}`
            out.add(internal)
            out.add(relativizePath(normalizeFilePath(internal), config.root))
          }

          if (normalized.startsWith('\0')) {
            const browser = `${VITE_BROWSER_VIRTUAL_PREFIX}${normalized.slice(1)}`
            out.add(browser)
            out.add(relativizePath(normalizeFilePath(browser), config.root))
          }

          cached = Array.from(out)
          candidateCache.set(id, cached)
          return cached
        }

        // Collect all module IDs that survived tree-shaking in this bundle.
        const survivingModules = new Set<string>()
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk') {
            for (const moduleId of Object.keys(chunk.modules)) {
              for (const candidate of toModuleIdCandidates(moduleId)) {
                survivingModules.add(candidate)
              }
            }
          }
        }

        const didModuleSurvive = (moduleId: string): boolean =>
          toModuleIdCandidates(moduleId).some((candidate) =>
            survivingModules.has(candidate),
          )

        // Check each deferred violation: if its check module survived
        // in the bundle, the import was NOT tree-shaken — real leak.
        const realViolations: Array<ViolationInfo> = []
        for (const {
          info,
          mockModuleId,
          checkModuleId,
        } of env.deferredBuildViolations) {
          let survived: boolean
          if (checkModuleId != null) {
            // Marker violation: check if the importer survived
            // (marker is about the file's directive, not a binding).
            // Include transform-result keys (e.g. code-split variants)
            // to cover all bundle representations of the importer.
            const importerVariantIds = new Set<string>([info.importer])
            const importerKeys = env.transformResultKeysByFile.get(
              normalizeFilePath(info.importer),
            )
            if (importerKeys) {
              for (const key of importerKeys) {
                importerVariantIds.add(key)
              }
            }
            survived = false
            for (const importerId of importerVariantIds) {
              if (didModuleSurvive(importerId)) {
                survived = true
                break
              }
            }
          } else {
            // File/specifier violation: check if the mock module survived.
            survived = didModuleSurvive(mockModuleId)
          }

          if (!survived) continue

          await enrichViolationInfo(
            env.transformResultProvider,
            env,
            info.env,
            info.envType,
            info.importer,
            info,
          )

          if (config.onViolation) {
            const result = await config.onViolation(info)
            if (result === false) continue
          }

          realViolations.push(info)
        }

        if (realViolations.length === 0) return

        if (config.effectiveBehavior === 'error') {
          // Error mode: fail the build on the first real violation.
          this.error(formatViolation(realViolations[0]!, config.root))
        } else {
          // Mock mode: warn for each surviving violation.
          const seen = new Set<string>()
          for (const info of realViolations) {
            const key = dedupeKey(info)
            if (!seen.has(key)) {
              seen.add(key)
              this.warn(formatViolation(info, config.root))
            }
          }
        }
      },

      closeBundle() {
        const envName = this.environment.name
        perf?.count('closeBundle.calls')
        perf?.count(`closeBundle.env.${envName}`)
        perf?.flush(config.root, envName)
      },
    },
    {
      // Captures transformed code + composed sourcemap for location mapping.
      // Runs after all `enforce: 'pre'` hooks (including the Start compiler).
      // Only files under `srcDirectory` are cached.
      name: 'tanstack-start-core:import-protection-transform-cache',

      applyToEnvironment(env) {
        if (!config.enabled) return false
        return environmentNames.has(env.name)
      },

      transform: {
        filter: {
          id: {
            include: [/\.[cm]?[tj]sx?($|\?)/],
          },
        },
        async handler(code, id) {
          perf?.count('transform.calls')
          const envName = this.environment.name
          const file = normalizeFilePath(id)
          const envType = getImportProtectionEnvType(config, envName)
          const matchers = getRulesForEnvironment(envName)
          const isBuild = config.command === 'build'

          if (IMPORT_PROTECTION_DEBUG) {
            if (matchesDebugFilter(file)) {
              debugLog('transform-cache', {
                env: envName,
                id: normalizePath(id),
                file,
              })
            }
          }

          if (!shouldCheckImporter(file)) {
            return undefined
          }

          // Self-denial: if this file is denied in the current environment
          // (e.g. a `.server` file transformed in the client environment),
          // replace its entire content with a mock module.
          //
          // This is the core mechanism for preventing cross-environment
          // cache contamination: resolveId never returns virtual module
          // IDs for file-based violations, so there is nothing for
          // third-party resolver caches (e.g. vite-tsconfig-paths) to
          // leak across environments.  Each environment's transform
          // independently decides whether the file is denied.
          //
          // In dev mode, this also solves the cold-start problem where
          // the importer's AST is unavailable for export resolution:
          // the denied file's own source code is always available here,
          // so we parse its exports directly.
          const selfFileMatch = checkFileDenial(getRelativePath(file), matchers)
          if (selfFileMatch) {
            // Parse exports once — shared by build and dev paths.
            // Falls back to empty list on non-standard syntax.
            let exportNames: Array<string> = []
            try {
              exportNames = getNamedExports(code, file, perf)
            } catch {
              // Parsing may fail on non-standard syntax
            }

            if (isBuild) {
              return generateSelfContainedMockModule(exportNames)
            }

            // Dev mode: generate a mock that imports mock-runtime for
            // runtime diagnostics (error/warn on property access).
            const runtimeId = mockRuntimeModuleIdFromViolation(
              {
                type: 'file',
                env: envType,
                envType,
                behavior:
                  config.effectiveBehavior === 'error' ? 'error' : 'mock',
                importer: file,
                specifier: relativizePath(file, config.root),
                resolved: file,
                pattern: selfFileMatch.pattern,
                trace: [],
              },
              config.mockAccess,
              config.root,
            )
            return generateDevSelfDenialModule(exportNames, runtimeId)
          }

          const cacheKey = normalizePath(id)

          const envState = getEnv(envName)
          const isServerFnLookup = id.includes(SERVER_FN_LOOKUP_QUERY)

          // Propagate SERVER_FN_LOOKUP status before import-analysis
          if (isServerFnLookup) {
            envState.serverFnLookupModules.add(file)
          }

          const result: TransformResult = {
            code,
            filename: file,
            map: undefined,
            originalCode: undefined,
          }

          if (perf) {
            result.perf = perf
          }

          if (shouldCaptureDiagnosticSourceMap(code, envType, matchers)) {
            captureDiagnosticSourceMap(
              result,
              () => this.getCombinedSourcemap(),
              'candidate',
            )
          }

          cacheTransformResult(envState, file, cacheKey, result)

          // Build mode: only self-denial (above) and transform caching are
          // needed.  All violations are detected and deferred in resolveId;
          // self-denial replaces denied file content; generateBundle checks
          // tree-shaking survival.  The import resolution loop below is
          // dev-mode only — it resolves imports for graph reachability,
          // catches violations missed on warm starts (where Vite caches
          // resolveId), and rewrites denied imports to mock modules.
          if (isBuild) return undefined

          // Dev mode: resolve imports, populate graph, detect violations,
          // and rewrite denied imports.
          const isDevMock = config.effectiveBehavior === 'mock'
          const importAnalysisStartedAt = perf ? performance.now() : 0
          const importSources = getImportSourcesFromResult(result)
          if (perf) {
            perf.time('transform.importAnalysis', importAnalysisStartedAt)
          }
          perf?.count('transform.importSources', importSources.length)
          const resolvedChildren = new Set<string>()
          const deniedSourceReplacements = new Map<string, string>()
          for (const src of importSources) {
            try {
              const startedAt = perf ? performance.now() : 0
              perf?.count('transform.thisResolve.calls')
              const resolved = await this.resolve(src, id, { skipSelf: true })
              if (perf) {
                perf.time('transform.thisResolve', startedAt)
              }
              if (resolved && !resolved.external) {
                const resolvedPath = canonicalizeResolvedId(
                  resolved.id,
                  config.root,
                  resolveExtensionlessAbsoluteId,
                )

                resolvedChildren.add(resolvedPath)

                // When the resolved ID is a mock-module (from our
                // resolveId returning a mock-edge ID), postTransformImports
                // would only contain the mock ID.  Edge-survival needs the
                // real physical path so pending violations can be matched.
                //
                // For relative specifiers we can compute the physical path
                // directly.  For bare/alias specifiers, look up the real
                // resolved path from the pending violations that were
                // already stored by resolveId before this transform ran.
                if (resolved.id.includes('tanstack-start-import-protection:')) {
                  let physicalPath: string | undefined
                  // Look up real resolved path from pending violations
                  const pending = envState.pendingViolations.get(file)
                  if (pending) {
                    const match = pending.find(
                      (pv) => pv.info.specifier === src && pv.info.resolved,
                    )
                    if (match) physicalPath = match.info.resolved
                  }
                  if (physicalPath && physicalPath !== resolvedPath) {
                    resolvedChildren.add(physicalPath)
                    envState.graph.addEdge(physicalPath, file, src)
                  }
                }

                // Populate import graph edges for warm-start trace accuracy
                envState.graph.addEdge(resolvedPath, file, src)

                if (isDevMock) {
                  const relativePath = getRelativePath(resolvedPath)
                  const fileMatch = checkFileDenial(relativePath, matchers)

                  if (fileMatch) {
                    captureDiagnosticSourceMap(
                      result,
                      () => this.getCombinedSourcemap(),
                      'devViolation',
                    )

                    const info = buildFileViolationInfo(
                      envName,
                      envType,
                      file,
                      src,
                      resolvedPath,
                      fileMatch.pattern,
                    )

                    const replacement = await reportOrDeferViolation(
                      this,
                      envState,
                      file,
                      id,
                      info,
                      isDevMock,
                      isServerFnLookup,
                    )

                    if (replacement) {
                      deniedSourceReplacements.set(
                        src,
                        replacement.startsWith('\0')
                          ? VITE_BROWSER_VIRTUAL_PREFIX + replacement.slice(1)
                          : replacement,
                      )
                    }
                  }
                }
              }
            } catch {
              // Non-fatal
            }
          }
          envState.postTransformImports.set(cacheKey, resolvedChildren)
          if (cacheKey !== file && !isServerFnLookup) {
            envState.postTransformImports.set(file, resolvedChildren)
          }

          await processPendingViolations(envState, this.warn.bind(this))

          if (deniedSourceReplacements.size > 0) {
            try {
              const rewritten = rewriteDeniedImports(
                code,
                id,
                new Set(deniedSourceReplacements.keys()),
                (source: string) =>
                  deniedSourceReplacements.get(source) ?? source,
              )

              if (!rewritten) {
                return undefined
              }

              const normalizedMap = rewritten.map
                ? normalizeSourceMap(rewritten.map)
                : {
                    version: 3,
                    file: id,
                    names: [],
                    sources: [id],
                    sourcesContent: [code],
                    mappings: '',
                  }

              return {
                code: rewritten.code,
                map: normalizedMap,
              }
            } catch {
              // Non-fatal: keep original code when rewrite fails.
            }
          }

          return undefined
        },
      },
    },
  ] satisfies Array<PluginOption>
}
