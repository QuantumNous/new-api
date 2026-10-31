import { matchesAny } from './matchers'
import { isInsideDirectory, normalizeFilePath, relativizePath } from './utils'
import type { CompiledMatcher } from './matchers'

export type ImportProtectionEnvType = 'client' | 'server'

export interface ImportProtectionEnvRules {
  specifiers: Array<CompiledMatcher>
  files: Array<CompiledMatcher>
  excludeFiles: Array<CompiledMatcher>
}

/**
 * Shared subset of adapter config used to decide which environment rules apply
 * and whether an importer should be checked at all.
 */
export interface ImportProtectionAdapterConfig {
  root: string
  srcDirectory: string
  compiledRules: {
    client: ImportProtectionEnvRules
    server: ImportProtectionEnvRules
  }
  includeMatchers: Array<CompiledMatcher>
  excludeMatchers: Array<CompiledMatcher>
  ignoreImporterMatchers: Array<CompiledMatcher>
  envTypeMap: Map<string, ImportProtectionEnvType>
}

export function getImportProtectionRelativePath(
  root: string,
  absolutePath: string,
): string {
  return relativizePath(normalizeFilePath(absolutePath), root)
}

export function getImportProtectionEnvType(
  config: Pick<ImportProtectionAdapterConfig, 'envTypeMap'>,
  envName: string,
): ImportProtectionEnvType {
  return config.envTypeMap.get(envName) ?? 'server'
}

export function getImportProtectionRulesForEnvironment(
  config: Pick<ImportProtectionAdapterConfig, 'compiledRules' | 'envTypeMap'>,
  envName: string,
): ImportProtectionEnvRules {
  return getImportProtectionEnvType(config, envName) === 'client'
    ? config.compiledRules.client
    : config.compiledRules.server
}

export function shouldCheckImportProtectionImporter(
  config: Pick<
    ImportProtectionAdapterConfig,
    | 'root'
    | 'srcDirectory'
    | 'includeMatchers'
    | 'excludeMatchers'
    | 'ignoreImporterMatchers'
  >,
  importer: string,
  cache?: Map<string, boolean>,
): boolean {
  const normalizedImporter = normalizeFilePath(importer)

  if (cache) {
    const cached = cache.get(normalizedImporter)
    if (cached !== undefined) {
      return cached
    }
  }

  const relativePath = relativizePath(normalizedImporter, config.root)

  let result: boolean
  if (
    (config.excludeMatchers.length > 0 &&
      matchesAny(relativePath, config.excludeMatchers)) ||
    (config.ignoreImporterMatchers.length > 0 &&
      matchesAny(relativePath, config.ignoreImporterMatchers))
  ) {
    result = false
  } else if (config.includeMatchers.length > 0) {
    result = !!matchesAny(relativePath, config.includeMatchers)
  } else if (config.srcDirectory) {
    result = isInsideDirectory(normalizedImporter, config.srcDirectory)
  } else {
    result = true
  }

  cache?.set(normalizedImporter, result)
  return result
}
