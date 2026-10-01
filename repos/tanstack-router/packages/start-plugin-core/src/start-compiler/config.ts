import {
  KindDetectionPatterns,
  getExternalLookupKind,
  getLookupKindsForEnv,
  isCompilerTransformEnabledForEnv,
  isStartCompilerPluginEnabledForEnv,
} from './compiler'
import type { BuiltInLookupKind, LookupConfig } from './compiler'
import type {
  CompileStartFrameworkOptions,
  StartCompilerImportTransform,
  StartCompilerPlugin,
} from '../types'

export function getTransformCodeFilterForEnv(
  env: 'client' | 'server',
  opts?: {
    compilerTransforms?: Array<StartCompilerImportTransform> | undefined
    compilerPlugins?: Array<StartCompilerPlugin> | undefined
  },
): Array<RegExp> {
  const validKinds = getLookupKindsForEnv(env, opts)
  const patterns: Array<RegExp> = []

  for (const [kind, pattern] of Object.entries(KindDetectionPatterns) as Array<
    [BuiltInLookupKind, RegExp]
  >) {
    if (validKinds.has(kind)) {
      patterns.push(pattern)
    }
  }

  for (const transform of opts?.compilerTransforms ?? []) {
    if (isCompilerTransformEnabledForEnv(transform, env)) {
      patterns.push(transform.detect)
    }
  }

  for (const plugin of opts?.compilerPlugins ?? []) {
    if (plugin.detect && isStartCompilerPluginEnabledForEnv(plugin, env)) {
      patterns.push(plugin.detect)
    }
  }

  return patterns
}

export function getLookupConfigurationsForEnv(
  env: 'client' | 'server',
  framework: CompileStartFrameworkOptions,
  opts?: {
    compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  },
): Array<LookupConfig> {
  const commonConfigs: Array<LookupConfig> = [
    {
      libName: `@tanstack/${framework}-start`,
      rootExport: 'createServerFn',
      kind: 'Root',
    },
    {
      libName: `@tanstack/${framework}-start`,
      rootExport: 'createIsomorphicFn',
      kind: 'IsomorphicFn',
    },
    {
      libName: `@tanstack/${framework}-start`,
      rootExport: 'createServerOnlyFn',
      kind: 'ServerOnlyFn',
    },
    {
      libName: `@tanstack/${framework}-start`,
      rootExport: 'createClientOnlyFn',
      kind: 'ClientOnlyFn',
    },
  ]

  const externalConfigs: Array<LookupConfig> = []
  for (const transform of opts?.compilerTransforms ?? []) {
    if (!isCompilerTransformEnabledForEnv(transform, env)) continue

    const kind = getExternalLookupKind(transform)
    for (const imported of transform.imports) {
      externalConfigs.push({
        libName: imported.libName,
        rootExport: imported.rootExport,
        kind,
      })
    }
  }

  if (env === 'client') {
    return [
      {
        libName: `@tanstack/${framework}-start`,
        rootExport: 'createMiddleware',
        kind: 'Root',
      },
      {
        libName: `@tanstack/${framework}-start`,
        rootExport: 'createStart',
        kind: 'Root',
      },
      ...commonConfigs,
      ...externalConfigs,
    ]
  }

  const serverConfigs: Array<LookupConfig> = [
    ...commonConfigs,
    {
      libName: `@tanstack/${framework}-router`,
      rootExport: 'ClientOnly',
      kind: 'ClientOnlyJSX',
    },
  ]

  return [...serverConfigs, ...externalConfigs]
}
