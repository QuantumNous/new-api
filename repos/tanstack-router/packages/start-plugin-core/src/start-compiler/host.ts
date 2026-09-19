import { StartCompiler, getLookupKindsForEnv } from './compiler'
import { getLookupConfigurationsForEnv } from './config'
import type {
  CompileStartFrameworkOptions,
  StartCompilerImportTransform,
  StartCompilerPlugin,
  StartCompilerTransformResult,
  StartCompilerVirtualModuleContext,
} from '../types'
import type {
  DevServerFnModuleSpecifierEncoder,
  GenerateFunctionIdFnOptional,
  ServerFn,
} from './types'

export interface CreateStartCompilerOptions {
  env: 'client' | 'server'
  envName: string
  root: string
  framework: CompileStartFrameworkOptions
  providerEnvName: string
  mode: 'dev' | 'build'
  generateFunctionId?: GenerateFunctionIdFnOptional
  compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  compilerPlugins?: Array<StartCompilerPlugin> | undefined
  serverFnProviderModuleDirectives?: ReadonlyArray<string> | undefined
  warn?: (message: string) => void
  onServerFnsById?: (d: Record<string, ServerFn>) => void
  getKnownServerFns: () => Record<string, ServerFn>
  encodeModuleSpecifierInDev?: DevServerFnModuleSpecifierEncoder
  loadModule: (id: string) => Promise<void>
  resolveId: (id: string, importer?: string) => Promise<string | null>
}

export function createStartCompiler(
  options: CreateStartCompilerOptions,
): StartCompiler {
  return new StartCompiler({
    env: options.env,
    envName: options.envName,
    root: options.root,
    lookupKinds: getLookupKindsForEnv(options.env, {
      compilerTransforms: options.compilerTransforms,
    }),
    lookupConfigurations: getLookupConfigurationsForEnv(
      options.env,
      options.framework,
      { compilerTransforms: options.compilerTransforms },
    ),
    mode: options.mode,
    framework: options.framework,
    providerEnvName: options.providerEnvName,
    generateFunctionId: options.generateFunctionId,
    onServerFnsById: options.onServerFnsById,
    compilerTransforms: options.compilerTransforms,
    compilerPlugins: options.compilerPlugins,
    serverFnProviderModuleDirectives: options.serverFnProviderModuleDirectives,
    warn: options.warn,
    getKnownServerFns: options.getKnownServerFns,
    devServerFnModuleSpecifierEncoder: options.encodeModuleSpecifierInDev,
    loadModule: options.loadModule,
    resolveId: options.resolveId,
  })
}

export function mergeServerFnsById(
  current: Record<string, ServerFn>,
  next: Record<string, ServerFn>,
): void {
  for (const [id, fn] of Object.entries(next)) {
    const existing = current[id]

    if (existing) {
      current[id] = {
        ...fn,
        isClientReferenced:
          existing.isClientReferenced || fn.isClientReferenced,
      }
      continue
    }

    current[id] = fn
  }
}

export function matchesCodeFilters(
  code: string,
  filters: ReadonlyArray<RegExp>,
): boolean {
  for (const pattern of filters) {
    pattern.lastIndex = 0
    if (pattern.test(code)) {
      return true
    }
  }

  return false
}

export function createCompilerVirtualModuleIdPattern(
  compilerPlugins: ReadonlyArray<StartCompilerPlugin>,
) {
  const patterns = compilerPlugins
    .map((plugin) => plugin.virtualModuleIdPattern)
    .filter((pattern): pattern is RegExp => !!pattern)

  if (patterns.length === 0) {
    return undefined
  }

  return new RegExp(
    patterns.map((pattern) => `(?:${pattern.source})`).join('|'),
  )
}

export function loadCompilerVirtualModule(
  compilerPlugins: ReadonlyArray<StartCompilerPlugin>,
  context: StartCompilerVirtualModuleContext,
): StartCompilerTransformResult | null {
  for (const compilerPlugin of compilerPlugins) {
    const pattern = compilerPlugin.virtualModuleIdPattern
    if (!pattern) {
      continue
    }

    pattern.lastIndex = 0
    if (!pattern.test(context.id)) {
      continue
    }

    const result = compilerPlugin.loadVirtualModule?.(context)
    if (result) {
      return result
    }
  }

  return null
}
