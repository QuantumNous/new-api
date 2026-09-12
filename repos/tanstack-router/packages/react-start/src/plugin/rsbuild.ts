import {
  RSBUILD_ENVIRONMENT_NAMES,
  tanStackStartRsbuild,
} from '@tanstack/start-plugin-core/rsbuild'
import { createRscCssCompilerTransforms } from '@tanstack/react-start-rsc/plugin/rscCssTransform'
import { reactStartDefaultEntryPaths } from './shared'
import type {
  TanStackStartRsbuildInputConfig,
  TanStackStartRsbuildPluginCoreOptions,
} from '@tanstack/start-plugin-core/rsbuild'
import type { RsbuildPlugin } from '@rsbuild/core'

export function tanstackStart(
  options?: TanStackStartRsbuildInputConfig & { rsc?: { enabled?: boolean } },
): RsbuildPlugin {
  const rscEnabled = options?.rsc?.enabled ?? false

  let corePluginOpts: TanStackStartRsbuildPluginCoreOptions = {
    framework: 'react',
    defaultEntryPaths: reactStartDefaultEntryPaths,
    providerEnvironmentName: RSBUILD_ENVIRONMENT_NAMES.server,
    ssrIsProvider: true,
  }

  if (rscEnabled) {
    const rscConfig = configureRscRsbuild()
    corePluginOpts = {
      ...corePluginOpts,
      providerEnvironmentName: rscConfig.providerEnvironmentName,
      ssrIsProvider: false,
      serializationAdapters: rscConfig.serializationAdapters,
      compilerTransforms: rscConfig.compilerTransforms,
      serverFnProviderModuleDirectives:
        rscConfig.serverFnProviderModuleDirectives,
      rsc: true,
    }
  }

  return tanStackStartRsbuild(corePluginOpts, options)
}

/**
 * Configure RSC options for the rsbuild adapter.
 *
 * Returns provider env, serialization adapters, and core RSC options.
 *
 * The SSR resolver strategy is intentionally NOT changed from 'default' —
 * in the rspack layered model, SSR and RSC live in the same
 * compilation so they share the same resolver file. No forwarding needed.
 */
function configureRscRsbuild(): {
  providerEnvironmentName: TanStackStartRsbuildPluginCoreOptions['providerEnvironmentName']
  serializationAdapters: TanStackStartRsbuildPluginCoreOptions['serializationAdapters']
  compilerTransforms: TanStackStartRsbuildPluginCoreOptions['compilerTransforms']
  serverFnProviderModuleDirectives: TanStackStartRsbuildPluginCoreOptions['serverFnProviderModuleDirectives']
} {
  return {
    providerEnvironmentName: RSBUILD_ENVIRONMENT_NAMES.server,
    serializationAdapters: [
      {
        client: {
          module: '@tanstack/react-start/rsc/serialization/client',
          export: 'rscSerializationAdapter',
          isFactory: true,
        },
        server: {
          module: '@tanstack/react-start/rsc/serialization/server',
          export: 'rscSerializationAdapter',
          isFactory: true,
        },
      },
    ],
    compilerTransforms: createRscCssCompilerTransforms({
      loadCssExpression: 'import.meta.rspackRsc.loadCss()',
      serverFnProviderOnly: true,
    }),
    serverFnProviderModuleDirectives: ['use server-entry'],
  }
}
