import {
  START_ENVIRONMENT_NAMES,
  tanStackStartVite,
} from '@tanstack/start-plugin-core/vite'
import type {
  TanStackStartViteInputConfig,
  TanStackStartVitePluginCoreOptions,
} from '@tanstack/start-plugin-core/vite'
import {
  configureRsc,
  reactStartRscVitePlugin,
} from '@tanstack/react-start-rsc/plugin/vite'
import path from 'pathe'
import { reactStartDefaultEntryPaths, reactStartPluginDir } from './shared'
import type { PluginOption } from 'vite'

const isInsideRouterMonoRepo =
  path.basename(path.resolve(reactStartPluginDir, '../../../../')) ===
  'packages'

export function tanstackStart(
  options?: TanStackStartViteInputConfig & { rsc?: { enabled?: boolean } },
): Array<PluginOption> {
  const rscEnabled = options?.rsc?.enabled ?? false
  const rscConfig = rscEnabled ? configureRsc() : undefined
  let corePluginOpts: TanStackStartVitePluginCoreOptions = {
    framework: 'react',
    defaultEntryPaths: reactStartDefaultEntryPaths,
    providerEnvironmentName: START_ENVIRONMENT_NAMES.server,
    ssrIsProvider: true,
    ssrResolverStrategy: {
      type: 'default',
    },
  }

  const serverEnvironments: Array<string> = [
    START_ENVIRONMENT_NAMES.server,
    ...(rscConfig ? [rscConfig.envName] : []),
  ]

  if (rscConfig) {
    corePluginOpts = {
      ...corePluginOpts,
      providerEnvironmentName: rscConfig.providerEnvironmentName,
      ssrIsProvider: false,
      ssrResolverStrategy: rscConfig.ssrResolverStrategy,
      serializationAdapters: rscConfig.serializationAdapters,
      compilerTransforms: rscConfig.compilerTransforms,
    }
  }
  return [
    {
      name: 'tanstack-react-start:config',
      configEnvironment(environmentName, options) {
        const needsOptimizeDeps =
          environmentName === START_ENVIRONMENT_NAMES.client ||
          (serverEnvironments.includes(environmentName) &&
            // This indicates that the server environment has opted in to dependency optimization
            options.optimizeDeps?.noDiscovery === false)

        // Check if @tanstack/react-router is in noExternal (as array)
        const reactRouterInNoExternal =
          Array.isArray(options.resolve?.noExternal) &&
          options.resolve.noExternal.some(
            (pattern) =>
              pattern === '@tanstack/react-router' ||
              (typeof pattern === 'string' && pattern.includes('react-router')),
          )

        return {
          resolve: {
            dedupe: [
              'react',
              'react-dom',
              '@tanstack/react-start',
              '@tanstack/react-router',
            ],
            // Don't mark react-router as external if:
            // 1. noExternal is true (bundle everything)
            // 2. We're not in the router monorepo
            // 3. react-router is explicitly in noExternal for this environment
            external:
              options.resolve?.noExternal === true ||
              !isInsideRouterMonoRepo ||
              reactRouterInNoExternal
                ? undefined
                : ['@tanstack/react-router', '@tanstack/react-router-devtools'],
          },
          optimizeDeps: needsOptimizeDeps
            ? {
                // As `@tanstack/react-start` depends on `@tanstack/react-router`, we should exclude both.
                exclude: [
                  '@tanstack/react-start',
                  '@tanstack/react-router',
                  '@tanstack/react-router-devtools',
                  '@tanstack/start-static-server-functions',
                ],
                include: [
                  'react',
                  'react/jsx-runtime',
                  'react/jsx-dev-runtime',
                  'react-dom',
                  ...(environmentName === START_ENVIRONMENT_NAMES.client
                    ? ['react-dom/client']
                    : ['react-dom/server']),
                  // `@tanstack/react-store` has a dependency on `use-sync-external-store`, which is CJS.
                  // It therefore needs to be included so that it is converted to ESM.
                  '@tanstack/react-router > @tanstack/react-store',
                  ...(options.optimizeDeps?.exclude?.find(
                    (x) => x === '@tanstack/react-form',
                  )
                    ? ['@tanstack/react-form > @tanstack/react-store']
                    : []),
                ],
              }
            : undefined,
        }
      },
    },
    rscConfig ? reactStartRscVitePlugin() : null,
    tanStackStartVite(corePluginOpts, options),
  ]
}
