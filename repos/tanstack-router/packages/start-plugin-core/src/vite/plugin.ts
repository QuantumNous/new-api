import { crawlFrameworkPkgs } from 'vitefu'
import {
  applyResolvedBaseAndOutput,
  applyResolvedRouterBasepath,
  createStartConfigContext,
} from '../config-context'
import { START_ENVIRONMENT_NAMES } from '../constants'
import {
  createServerFnBasePath,
  normalizePublicBase,
  shouldRewriteDevBasepath,
} from '../planning'
import { importProtectionPlugin } from './import-protection-plugin/plugin'
import { startCompilerPlugin } from './start-compiler-plugin/plugin'
import { loadEnvPlugin } from './load-env-plugin/plugin'
import {
  buildStartViteEnvironments,
  createViteConfigPlan,
  createViteDefineConfig,
  createViteResolvedEntryAliases,
} from './planning'
import { devServerPlugin } from './dev-server-plugin/plugin'
import { previewServerPlugin } from './preview-server-plugin/plugin'
import {
  createDevBaseRewritePlugin,
  createDevClientEntryPlugin,
  createPostBuildPlugin,
} from './plugins'
import { parseStartConfig } from './schema'
import { startManifestPlugin } from './start-manifest-plugin/plugin'
import { tanStackStartRouter } from './start-router-plugin/plugin'
import {
  getClientOutputDirectory,
  getServerOutputDirectory,
} from './output-directory'
import { postServerBuild } from './post-server-build'
import { serializationAdaptersPlugin } from './serialization-adapters-plugin'
import type {
  TanStackStartVitePluginCoreOptions,
  ViteRscForwardSsrResolverStrategy,
} from './types'
import type { TanStackStartViteInputConfig } from './schema'
import type { PluginOption } from 'vite'

export function tanStackStartVite(
  corePluginOpts: TanStackStartVitePluginCoreOptions,
  startPluginOpts: TanStackStartViteInputConfig | undefined,
): Array<PluginOption> {
  const normalizedStartPluginOpts = startPluginOpts ?? {}

  const configContext = createStartConfigContext({
    corePluginOpts,
    startPluginOpts: normalizedStartPluginOpts,
    parseConfig: parseStartConfig,
  })
  const { getConfig, resolvedStartConfig } = configContext
  const serverFnProviderEnv = corePluginOpts.providerEnvironmentName
  const ssrIsProvider = corePluginOpts.ssrIsProvider

  // When the router basepath and vite base are misaligned during dev,
  // we install a URL rewrite middleware instead of erroring.
  let needsDevBaseRewrite = false

  const environments: Array<{
    name: string
    type: 'client' | 'server'
    getServerFnById?: string
  }> = [
    { name: START_ENVIRONMENT_NAMES.client, type: 'client' },
    {
      name: START_ENVIRONMENT_NAMES.server,
      type: 'server',
      getServerFnById:
        corePluginOpts.ssrResolverStrategy.type === 'vite-rsc-forward'
          ? createViteRscForwarder(corePluginOpts.ssrResolverStrategy)
          : undefined,
    },
  ]
  if (
    serverFnProviderEnv !== START_ENVIRONMENT_NAMES.server &&
    !environments.find((e) => e.name === serverFnProviderEnv)
  ) {
    environments.push({
      name: serverFnProviderEnv,
      type: 'server',
    })
  }
  return [
    {
      name: 'tanstack-start-core:config',
      enforce: 'pre',
      async config(viteConfig, { command }) {
        const publicBase = normalizePublicBase(viteConfig.base)
        applyResolvedBaseAndOutput({
          resolvedStartConfig,
          root: viteConfig.root || process.cwd(),
          publicBase,
          clientOutputDirectory: getClientOutputDirectory(viteConfig),
          serverOutputDirectory: getServerOutputDirectory(viteConfig),
        })
        const { startConfig } = getConfig()
        const routerBasepath = applyResolvedRouterBasepath({
          resolvedStartConfig,
          startConfig,
        })

        if (
          shouldRewriteDevBasepath({
            command,
            middlewareMode: Boolean(viteConfig.server?.middlewareMode),
            routerBasepath,
            publicBase: resolvedStartConfig.basePaths.publicBase,
          })
        ) {
          // The router basepath and vite base are misaligned.
          // Instead of erroring, we install a dev-server middleware that
          // rewrites incoming request URLs to prepend the vite base prefix.
          // This allows users to have e.g. base: '/_ui/' for asset URLs
          // while keeping router basepath at '/' for page navigation.
          needsDevBaseRewrite = true
        }

        const TSS_SERVER_FN_BASE = createServerFnBasePath({
          routerBasepath,
          serverFnBase: startConfig.serverFns.base,
        })
        const resolvedEntryPlan = configContext.resolveEntries()

        const entryAliases = createViteResolvedEntryAliases({
          entryPaths: resolvedEntryPlan.entryPaths,
        })

        const startPackageName =
          `@tanstack/${corePluginOpts.framework}-start` as const

        // crawl packages that have start in "peerDependencies"
        // see https://github.com/svitejs/vitefu/blob/d8d82fa121e3b2215ba437107093c77bde51b63b/src/index.js#L95-L101

        // this is currently uncached; could be implemented similarly as vite handles lock file changes
        // see https://github.com/vitejs/vite/blob/557f797d29422027e8c451ca50dd84bf8c41b5f0/packages/vite/src/node/optimizer/index.ts#L1282

        const crawlFrameworkPkgsResult = await crawlFrameworkPkgs({
          root: process.cwd(),
          isBuild: command === 'build',
          isFrameworkPkgByJson(pkgJson) {
            const peerDependencies = pkgJson['peerDependencies']

            if (peerDependencies) {
              if (
                startPackageName in peerDependencies ||
                '@tanstack/start-client-core' in peerDependencies
              ) {
                return true
              }
            }

            return false
          },
        })

        const viteConfigPlan = createViteConfigPlan({
          viteConfig,
          command,
          framework: corePluginOpts.framework,
          entryAliases,
          clientOutputDirectory: resolvedStartConfig.outputDirectories.client,
          serverOutputDirectory: resolvedStartConfig.outputDirectories.server,
          serverFnProviderEnv,
          optimizeDepsExclude: crawlFrameworkPkgsResult.optimizeDeps.exclude,
          noExternal: crawlFrameworkPkgsResult.ssr.noExternal.sort(),
        })

        return {
          // see https://vite.dev/config/shared-options.html#apptype
          // this will prevent vite from injecting middlewares that we don't want
          appType: viteConfig.appType ?? 'custom',
          environments: viteConfigPlan.environments,
          resolve: viteConfigPlan.resolve,
          define: createViteDefineConfig({
            command,
            mode: viteConfig.mode,
            serverFnBase: TSS_SERVER_FN_BASE,
            routerBasepath,
            spaEnabled: startConfig.spa?.enabled,
            devSsrStylesEnabled: startConfig.dev.ssrStyles.enabled,
            devSsrStylesBasepath:
              startConfig.dev.ssrStyles.basepath ??
              resolvedStartConfig.basePaths.publicBase,
            inlineCssEnabled:
              command === 'build' && startConfig.server.build.inlineCss.enabled,
            staticNodeEnv: startConfig.server.build.staticNodeEnv,
            disableCsrfMiddlewareWarning:
              startConfig.serverFns.disableCsrfMiddlewareWarning,
          }),
          builder: {
            sharedPlugins: true,
            async buildApp(builder) {
              await buildStartViteEnvironments({
                builder,
                providerEnvironmentName: serverFnProviderEnv,
                ssrIsProvider,
              })
            },
          },
        }
      },
    },
    createPostBuildPlugin({
      getConfig,
      postServerBuild,
    }),
    // Server function plugin handles:
    // 1. Identifying createServerFn().handler() calls
    // 2. Extracting server functions to separate modules
    // 3. Replacing call sites with RPC stubs
    // 4. Generating the server function manifest
    // Also handles createIsomorphicFn, createServerOnlyFn, createClientOnlyFn, createMiddleware
    startCompilerPlugin({
      framework: corePluginOpts.framework,
      environments,
      generateFunctionId:
        normalizedStartPluginOpts.serverFns?.generateFunctionId,
      compilerTransforms: corePluginOpts.compilerTransforms,
      serverFnProviderModuleDirectives:
        corePluginOpts.serverFnProviderModuleDirectives,
      providerEnvName: serverFnProviderEnv,
    }),
    importProtectionPlugin({
      getConfig,
      framework: corePluginOpts.framework,
      environments,
      providerEnvName: serverFnProviderEnv,
    }),
    tanStackStartRouter(normalizedStartPluginOpts, getConfig, corePluginOpts),
    loadEnvPlugin(),
    createDevClientEntryPlugin({
      framework: corePluginOpts.framework,
      getClientEntry: () => configContext.resolveEntries().entryPaths.client,
    }),
    startManifestPlugin({
      getConfig,
    }),
    // When the vite base and router basepath are misaligned (e.g. base: '/_ui/', basepath: '/'),
    // install a middleware that rewrites incoming request URLs to prepend the vite base prefix.
    // This allows Vite's internal base middleware to accept the requests, then strips the prefix
    // before passing to the SSR handler.
    // Registered BEFORE devServerPlugin so this middleware is added to the Connect stack first,
    // ensuring all subsequent middlewares (CSS, SSR, etc.) see the rewritten URL.
    createDevBaseRewritePlugin({
      shouldRewriteDevBase: () => needsDevBaseRewrite,
      resolvedStartConfig,
    }),
    devServerPlugin({
      getConfig,
      devSsrStylesEnabled:
        normalizedStartPluginOpts.dev?.ssrStyles?.enabled ?? true,
      installDevServerMiddleware:
        normalizedStartPluginOpts.vite?.installDevServerMiddleware,
    }),
    previewServerPlugin(),
    ...(corePluginOpts.serializationAdapters?.length
      ? [
          serializationAdaptersPlugin({
            adapters: corePluginOpts.serializationAdapters,
          }),
        ]
      : []),
  ]
}

function createViteRscForwarder(strategy: ViteRscForwardSsrResolverStrategy) {
  return `export async function getServerFnById(id, access) {
  const m = await import.meta.viteRsc.loadModule(${JSON.stringify(strategy.sourceEnvironmentName)}, ${JSON.stringify(strategy.sourceEntry)})
  return m[${JSON.stringify(strategy.exportName)}](id, access)
}`
}
