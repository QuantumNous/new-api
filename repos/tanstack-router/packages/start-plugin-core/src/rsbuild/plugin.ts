import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { joinURL } from 'ufo'
import {
  applyResolvedBaseAndOutput,
  applyResolvedRouterBasepath,
  createStartConfigContext,
} from '../config-context'
import { escapeRegExp, normalizePath } from '../utils'
import { createServerFnBasePath, normalizePublicBase } from '../planning'
import { parseStartConfig, rsbuildClientOutputSchema } from './schema'
import {
  RSBUILD_CLIENT_ASSETS_DIR,
  RSBUILD_ENVIRONMENT_NAMES,
  RSBUILD_RSC_LAYERS,
  createRsbuildEnvironmentPlan,
  createRsbuildResolvedEntryAliases,
  resolveRsbuildOutputDirectory,
} from './planning'
import { registerStartCompilerTransforms } from './start-compiler-host'
import { registerImportProtection } from './import-protection'
import {
  START_MANIFEST_PLACEHOLDER,
  registerVirtualModules,
} from './virtual-modules'
import { createServerSetup } from './server-middleware'
import { registerClientBuildCapture } from './normalized-client-build'
import { registerRouterPlugins } from './start-router-plugin'
import { postBuildWithRsbuild } from './post-build'
import { enableSwcReactServerComponents } from './swc-rsc'
import type { ServerFn } from '../start-compiler/types'
import type { TanStackStartRsbuildPluginCoreOptions } from './types'
import type {
  ModifyRspackConfigFn,
  RsbuildDevServer,
  RsbuildPlugin,
  RsbuildPluginAPI,
  Rspack,
  rspack as rspackNamespaceType,
} from '@rsbuild/core'
import type { TanStackStartRsbuildInputConfig } from './schema'
import type { ScriptFormat } from '@tanstack/router-core'

// Detect whether this plugin source is running from inside the TanStack
// Router monorepo (packages/start-plugin-core/src/rsbuild/plugin.ts). When
// installed from npm in a user app, the path structure is different and
// this evaluates to false. Used to gate dev-only workarounds that only
// matter when workspace package dists are symlinked into node_modules.
const currentDir = dirname(fileURLToPath(import.meta.url))
const isInsideRouterMonoRepo = (() => {
  // src layout: <repo>/packages/start-plugin-core/src/rsbuild → 4 levels up
  // dist layout (CJS/ESM): <repo>/packages/start-plugin-core/dist/<fmt>/rsbuild
  //   → also 4 levels up
  const candidate = resolve(currentDir, '../../../../')
  return candidate.endsWith('/packages') || candidate.endsWith('\\packages')
})()

type RspackNamespace = typeof rspackNamespaceType
type RscPluginPair = ReturnType<
  NonNullable<RspackNamespace['experiments']['rsc']>['createPlugins']
>
type RspackConfig = Parameters<ModifyRspackConfigFn>[0]
type RspackCompiler = Rspack.Compiler
type RspackCompilationExtended = Rspack.Compilation
type RspackAsset = ReturnType<RspackCompilationExtended['getAssets']>[number]

export function tanStackStartRsbuild(
  corePluginOpts: TanStackStartRsbuildPluginCoreOptions,
  startPluginOpts: TanStackStartRsbuildInputConfig = {},
): RsbuildPlugin {
  const rscOpts = corePluginOpts.rsc
  const rscEnabled = Boolean(rscOpts)

  const configContext = createStartConfigContext({
    corePluginOpts,
    startPluginOpts,
    parseConfig: parseStartConfig,
  })
  const { getConfig, resolvedStartConfig } = configContext
  const serverFnProviderEnv = corePluginOpts.providerEnvironmentName
  const ssrIsProvider = corePluginOpts.ssrIsProvider
  const scriptFormat = rsbuildClientOutputSchema.parse(
    startPluginOpts.rsbuild?.client?.output ?? 'module',
  ) satisfies ScriptFormat

  // RSC plugin instances — created lazily when rspack namespace is available
  let rscPlugins: RscPluginPair | undefined

  // Reference to the dev server for RSC HMR socket writes
  let devServerRef: Pick<RsbuildDevServer, 'sockWrite'> | null = null
  const serverFnsById: Record<string, ServerFn> = {}
  let updateServerFnResolver: (() => void) | undefined

  return {
    name: 'tanstack-start-rsbuild',
    setup(api: RsbuildPluginAPI) {
      const startCompilerEnvironments = [
        { name: RSBUILD_ENVIRONMENT_NAMES.client, type: 'client' as const },
        { name: RSBUILD_ENVIRONMENT_NAMES.server, type: 'server' as const },
        ...(serverFnProviderEnv !== RSBUILD_ENVIRONMENT_NAMES.server &&
        !rscEnabled
          ? [{ name: serverFnProviderEnv, type: 'server' as const }]
          : []),
      ]
      const startCompilerServerEnvironmentNames = startCompilerEnvironments
        .filter((env) => env.type === 'server')
        .map((env) => env.name)

      // ---------------------------------------------------------------
      // 1. modifyRsbuildConfig — resolve config, set up environments
      // ---------------------------------------------------------------
      api.modifyRsbuildConfig((rsbuildConfig, { mergeRsbuildConfig }) => {
        const root =
          typeof rsbuildConfig.root === 'string'
            ? rsbuildConfig.root
            : process.cwd()

        const serverBase = rsbuildConfig.server?.base
        const assetPrefix = rsbuildConfig.output?.assetPrefix
        const publicBase = normalizePublicBase(
          typeof serverBase === 'string'
            ? serverBase
            : typeof assetPrefix === 'string' && assetPrefix !== 'auto'
              ? assetPrefix
              : undefined,
        )
        const rootDistPath = rsbuildConfig.output?.distPath
        const clientDistPath =
          rsbuildConfig.environments?.[RSBUILD_ENVIRONMENT_NAMES.client]?.output
            ?.distPath
        const serverDistPath =
          rsbuildConfig.environments?.[RSBUILD_ENVIRONMENT_NAMES.server]?.output
            ?.distPath

        applyResolvedBaseAndOutput({
          resolvedStartConfig,
          root,
          publicBase,
          clientOutputDirectory: resolveRsbuildOutputDirectory({
            distPath: clientDistPath,
            rootDistPath,
            fallback: 'dist/client',
            subdirectory: 'client',
          }),
          serverOutputDirectory: resolveRsbuildOutputDirectory({
            distPath: serverDistPath,
            rootDistPath,
            fallback: 'dist/server',
            subdirectory: 'server',
          }),
        })

        const { startConfig } = getConfig()
        const routerBasepath = applyResolvedRouterBasepath({
          resolvedStartConfig,
          startConfig,
        })

        const resolvedEntryPlan = configContext.resolveEntries()
        const isDev = api.context.action === 'dev'
        const isPreview = api.context.action === 'preview'

        const entryAliases = createRsbuildResolvedEntryAliases({
          entryPaths: resolvedEntryPlan.entryPaths,
        })

        const environmentPlan = createRsbuildEnvironmentPlan({
          root,
          entryAliases,
          clientOutputDirectory: resolvedStartConfig.outputDirectories.client,
          serverOutputDirectory: resolvedStartConfig.outputDirectories.server,
          publicBase: resolvedStartConfig.basePaths.publicBase,
          serverFnProviderEnv,
          environmentOverrides: corePluginOpts.rsbuild?.environments,
          scriptFormat,
          rsc: rscOpts,
          dev: isDev,
        })
        const serverFnBase = createServerFnBasePath({
          routerBasepath,
          serverFnBase: startConfig.serverFns.base,
        })
        const inlineCssEnabled =
          !isDev && startConfig.server.build.inlineCss.enabled

        return mergeRsbuildConfig(rsbuildConfig, {
          source: {
            ...(rscEnabled
              ? {
                  include: [
                    // RSC needs SWC to inspect package code in node_modules so directives such as "use client" can be discovered.
                    // This follows Rsbuild's documented broad include form for compiling node_modules, with core-js excluded:
                    // https://rsbuild.rs/config/source/include#compile-node_modules
                    //
                    // TODO: Once the Rspack rule matching needed here is ready, narrow this to React-aware packages, for example via
                    // descriptionData: { "peerDependencies.react": /./ }, so unrelated dependencies are not sent through swc-loader.
                    {
                      not: /[\\/]core-js[\\/]/,
                    },
                  ],
                }
              : {}),
            define: {
              'process.env.TSS_SERVER_FN_BASE': JSON.stringify(serverFnBase),
              'import.meta.env.TSS_SERVER_FN_BASE':
                JSON.stringify(serverFnBase),
              'process.env.TSS_ROUTER_BASEPATH': JSON.stringify(routerBasepath),
              'import.meta.env.TSS_ROUTER_BASEPATH':
                JSON.stringify(routerBasepath),
              'process.env.TSS_DEV_SERVER': JSON.stringify(
                isDev ? 'true' : 'false',
              ),
              'import.meta.env.TSS_DEV_SERVER': JSON.stringify(
                isDev ? 'true' : 'false',
              ),
              // Rsbuild dev already injects emitted CSS asset hrefs, so keep
              // Start's synthetic `/@tanstack-start/styles.css` path disabled.
              'process.env.TSS_DEV_SSR_STYLES_ENABLED': JSON.stringify('false'),
              'import.meta.env.TSS_DEV_SSR_STYLES_ENABLED':
                JSON.stringify('false'),
              'process.env.TSS_DEV_SSR_STYLES_BASEPATH': JSON.stringify(
                resolvedStartConfig.basePaths.publicBase,
              ),
              'import.meta.env.TSS_DEV_SSR_STYLES_BASEPATH': JSON.stringify(
                resolvedStartConfig.basePaths.publicBase,
              ),
              'process.env.TSS_INLINE_CSS_ENABLED': JSON.stringify(
                inlineCssEnabled ? 'true' : 'false',
              ),
              'import.meta.env.TSS_INLINE_CSS_ENABLED': JSON.stringify(
                inlineCssEnabled ? 'true' : 'false',
              ),
              'process.env.TSS_DISABLE_CSRF_MIDDLEWARE_WARNING': JSON.stringify(
                startConfig.serverFns.disableCsrfMiddlewareWarning
                  ? 'true'
                  : 'false',
              ),
              'import.meta.env.TSS_DISABLE_CSRF_MIDDLEWARE_WARNING':
                JSON.stringify(
                  startConfig.serverFns.disableCsrfMiddlewareWarning
                    ? 'true'
                    : 'false',
                ),
            },
          },
          server: {
            ...(rsbuildConfig.server?.printUrls === undefined ||
            rsbuildConfig.server.printUrls === true
              ? { printUrls: ({ urls }: { urls: Array<string> }) => urls }
              : {}),
            // Rsbuild compression currently treats Node's raw header array
            // writeHead form as an object, which corrupts SSR response headers.
            compress: false,
            // SSR apps render every route on the server — disable HTML
            // fallback so rsbuild doesn't intercept /_serverFn/ URLs.
            htmlFallback: false,
            // server.setup returned callback runs after built-in middleware
            // but BEFORE fallback middleware — the ideal slot for SSR.
            // Preview always installs the middleware since it is the only SSR
            // handler; dev can opt out when a custom server hosts SSR.
            ...(isPreview ||
            (isDev &&
              startPluginOpts.rsbuild?.installDevServerMiddleware !== false)
              ? {
                  setup: createServerSetup({
                    serverFnBasePath: serverFnBase,
                    serverOutputDirectory:
                      resolvedStartConfig.outputDirectories.server,
                    publicBase: resolvedStartConfig.basePaths.publicBase,
                  }),
                }
              : {}),
          },
          ...(isDev
            ? {
                dev: {
                  lazyCompilation: false,
                  ...(rscEnabled ? { liveReload: false } : {}),
                },
              }
            : {}),
          environments: environmentPlan.environments,
          resolve: {
            alias: environmentPlan.alias,
          },
        })
      })

      // ---------------------------------------------------------------
      // 2. StartCompiler transforms — server fns, isomorphic fns, etc.
      // ---------------------------------------------------------------
      registerStartCompilerTransforms(api, {
        framework: corePluginOpts.framework,
        // modifyRsbuildConfig copies rsbuildConfig.root into resolvedStartConfig.root,
        // so defer this read until transform time instead of falling back to
        // process.cwd() during plugin setup.
        root: () => resolvedStartConfig.root || process.cwd(),
        environments: startCompilerEnvironments,
        providerEnvName: serverFnProviderEnv,
        generateFunctionId: startPluginOpts.serverFns?.generateFunctionId,
        compilerTransforms: corePluginOpts.compilerTransforms,
        serverFnProviderModuleDirectives:
          corePluginOpts.serverFnProviderModuleDirectives,
        serverFnsById,
        onServerFnsByIdChange: () => {
          updateServerFnResolver?.()
        },
      })

      registerImportProtection(api, {
        getConfig,
        framework: corePluginOpts.framework,
        environments: startCompilerEnvironments,
      })

      // ---------------------------------------------------------------
      // 3. Virtual modules — manifest, server fn resolver, adapters,
      //    RSC runtime, RSC HMR
      // ---------------------------------------------------------------
      const virtualModuleState = registerVirtualModules(api, {
        root: resolvedStartConfig.root || process.cwd(),
        getConfig,
        serverFnsById,
        providerEnvName: serverFnProviderEnv,
        ssrIsProvider,
        serializationAdapters: corePluginOpts.serializationAdapters,
        getDevClientEntryUrl: (publicBase: string) =>
          joinURL(publicBase, RSBUILD_CLIENT_ASSETS_DIR, 'js/index.js'),
        rscEnabled,
        scriptFormat,
      })
      updateServerFnResolver = virtualModuleState.updateServerFnResolver

      if (!rscEnabled) {
        api.modifyRspackConfig((config, utils) => {
          if (
            !startCompilerServerEnvironmentNames.includes(
              utils.environment.name,
            )
          ) {
            return
          }

          config.plugins.push({
            apply(compiler: RspackCompiler) {
              compiler.hooks.finishMake.tapPromise(
                {
                  name: 'TanStackStartServerFnResolverRebuild',
                  stage: -10,
                },
                async (compilation: RspackCompilationExtended) => {
                  virtualModuleState.updateServerFnResolver()

                  await rebuildModulesContaining(
                    compilation,
                    virtualModuleState.serverFnResolverPath,
                  )
                },
              )
            },
          })
        })
      }

      // ---------------------------------------------------------------
      // 4. Client build stats capture via processAssets
      // ---------------------------------------------------------------
      const { getClientBuild } = registerClientBuildCapture(api)

      // ---------------------------------------------------------------
      // 4b. Server manifest module generation (build only)
      //     For ordinary multi-environment builds, Rsbuild can compile the
      //     server environment after the client environment finishes. Generate
      //     the final manifest as module source in that phase instead of
      //     patching emitted server assets afterwards.
      // ---------------------------------------------------------------
      if (api.context.action !== 'dev') {
        const normalizedManifestPath = normalizePath(
          virtualModuleState.manifestPath,
        )
        const matchesManifestPath = (id: string) =>
          normalizePath(id) === normalizedManifestPath

        api.transform(
          {
            test: (id: string) => matchesManifestPath(id),
            environments: [RSBUILD_ENVIRONMENT_NAMES.server],
          },
          ({ code }) => {
            const clientBuild = getClientBuild()

            if (clientBuild) {
              return virtualModuleState.generateManifestContent(clientBuild)
            }

            if (!rscEnabled) {
              throw new Error(
                'TanStack Start could not generate the rsbuild server manifest before the client build completed',
              )
            }

            // RSC builds cannot express the required client -> server ordering
            // through MultiCompiler dependencies, so keep the placeholder for
            // the RSC-only asset-patching fallback below.
            return code
          },
        )
      }

      // ---------------------------------------------------------------
      // 5. Router plugin wiring (generator + code splitter)
      // ---------------------------------------------------------------
      registerRouterPlugins(api, {
        getConfig,
        corePluginOpts,
        startPluginOpts,
      })

      // ---------------------------------------------------------------
      // 6. Dev SSR middleware — registered via server.setup in
      //    modifyRsbuildConfig above (returned callback runs after
      //    built-ins but before fallback middleware)
      // ---------------------------------------------------------------

      // ---------------------------------------------------------------
      // 6b. Dev watcher: ignore workspace package `dist/**` directories.
      //
      //     In a real user app, `@tanstack/react-router` and friends live
      //     inside `node_modules/` and are ignored by Rspack's default
      //     watcher. In this monorepo, pnpm symlinks them to
      //     `packages/*/dist` (realpath outside node_modules), so the
      //     watcher follows them and treats their dist files as live
      //     sources. If anything rewrites those files during dev, Rspack
      //     sees transient half-written modules and fails to resolve
      //     relative imports between them.
      //
      //     Only apply this in monorepo development. In user apps this
      //     is a no-op — their `node_modules/@tanstack/*/dist/**` is
      //     already ignored by Rspack's default watchOptions.
      // ---------------------------------------------------------------
      if (isInsideRouterMonoRepo && api.context.action === 'dev') {
        api.modifyRspackConfig((config) => {
          const workspaceDistRealpaths = resolveWorkspacePackageDistRealpaths()
          if (workspaceDistRealpaths.length === 0) return

          const workspaceDistIgnored = new RegExp(
            workspaceDistRealpaths
              .map((path) => `^${escapeRegExp(path)}(?:[\\\\/]|$)`)
              .join('|'),
          )
          const ignored = config.watchOptions?.ignored

          config.watchOptions = {
            ...(config.watchOptions ?? {}),
            ignored:
              ignored == null
                ? new RegExp(
                    `${defaultRspackWatchIgnored.source}|${workspaceDistIgnored.source}`,
                  )
                : typeof ignored === 'string'
                  ? [ignored, ...workspaceDistRealpaths]
                  : Array.isArray(ignored)
                    ? [...ignored, ...workspaceDistRealpaths]
                    : new RegExp(
                        `${ignored.source}|${workspaceDistIgnored.source}`,
                      ),
          }
        })
      }

      // ---------------------------------------------------------------
      // 7. RSC: rspack layer rules + native RSC plugins
      //    When RSC is enabled, we add:
      //    - issuerLayer rule for react-server condition propagation
      //    - SWC reactServerComponents: true
      //    - rspack ServerPlugin (server env) / ClientPlugin (client env)
      //    The Coordinator inside createPlugins() handles compilation
      //    ordering (server→client→server-actions) automatically.
      // ---------------------------------------------------------------
      if (rscEnabled) {
        api.modifyRspackConfig((config, utils) => {
          const envName = utils.environment.name
          const isServerEnv = envName === RSBUILD_ENVIRONMENT_NAMES.server
          const isClientEnv = envName === RSBUILD_ENVIRONMENT_NAMES.client

          // Create RSC plugin pair lazily (once per build)
          if (!rscPlugins) {
            rscPlugins = utils.rspack.experiments.rsc.createPlugins()
          }

          if (isServerEnv) {
            // --- issuerLayer rule: modules imported from RSC layer
            // get react-server resolve condition ---
            const moduleRules = (config.module.rules ??= [])
            const root = resolvedStartConfig.root || process.cwd()

            // Split server-fn provider modules are the actual RSC execution
            // boundary in Start's layered model. They must compile in the
            // RSC layer so React and react-server-dom-rspack resolve their
            // react-server exports without forcing the whole SSR graph into
            // react-server conditions.
            moduleRules.push({
              resourceQuery: /(?:^|[?&])tss-serverfn-split(?:&|$)/,
              layer: RSBUILD_RSC_LAYERS.rsc,
              resolve: {
                conditionNames: ['react-server', '...'],
              },
            })

            // All modules imported from the RSC layer inherit
            // the react-server condition (transitive propagation), except
            // route split virtual modules. Those remain ordinary SSR/client
            // route code; only `?tsr-shared=1` modules may be shared with the
            // provider subtree.
            moduleRules.push({
              issuerLayer: RSBUILD_RSC_LAYERS.rsc,
              resourceQuery: {
                not: [/(?:^|[?&])tsr-split(?:=|&|$)/],
              },
              resolve: {
                conditionNames: ['react-server', '...'],
              },
            })

            // The RSC ServerPlugin injects imports like
            // `react-server-dom-rspack/server` into transformed modules.
            // Some modules in the server graph resolve from real package paths
            // outside the app root, so relying on the default relative
            // `node_modules` lookup is not enough. Seed resolve.modules with the
            // app root explicitly, without package-manager-specific heuristics.
            seedResolveModules(config, [`${root}/node_modules`, 'node_modules'])

            // Add ServerPlugin with HMR callback
            config.plugins.push(
              new rscPlugins.ServerPlugin({
                cssLink: {
                  precedence: false,
                  props: {
                    'data-rsc-css-href': '',
                  },
                },
                onServerComponentChanges: () => {
                  // Send rsc:update to connected clients for HMR
                  devServerRef?.sockWrite('custom', {
                    event: 'rsc:update',
                  })
                },
              }),
            )

            config.plugins.push({
              apply(compiler: RspackCompiler) {
                compiler.hooks.finishMake.tapPromise(
                  {
                    name: 'TanStackStartRscServerFnResolverRebuild',
                    stage: -10,
                  },
                  async (compilation: RspackCompilationExtended) => {
                    const resolverContent =
                      virtualModuleState.generateCurrentResolverContent(true)
                    virtualModuleState.tryUpdateServerFnResolver(
                      resolverContent,
                    )

                    await rebuildModulesContaining(
                      compilation,
                      virtualModuleState.serverFnResolverPath,
                    )
                  },
                )
              },
            })

            if (api.context.action !== 'dev') {
              config.plugins.push({
                apply(compiler: RspackCompiler) {
                  compiler.hooks.finishMake.tapPromise(
                    {
                      name: 'TanStackStartRscManifestRebuild',
                      // The native RSC ServerPlugin completes the client-entry
                      // handoff during its finishMake hook. Rebuild the manifest
                      // after that point so the transform hook can emit the final
                      // manifest source instead of the placeholder.
                      stage: 10,
                    },
                    async (compilation: RspackCompilationExtended) => {
                      const clientBuild = getClientBuild()

                      if (!clientBuild) {
                        return
                      }

                      virtualModuleState.updateManifest(clientBuild)

                      await rebuildModulesContaining(
                        compilation,
                        virtualModuleState.manifestPath,
                      )
                    },
                  )
                },
              })
            }
          }

          if (isClientEnv) {
            // Add ClientPlugin — the Coordinator links it to the
            // ServerPlugin's compilation state
            config.plugins.push(new rscPlugins.ClientPlugin())
          }

          // --- SWC reactServerComponents ---
          // Enable RSC directive detection where the native RSC plugins need it.
          // In the server build, scope it to the actual RSC provider subtree so
          // ordinary route-split modules (e.g. ?tsr-split=component) stay out of
          // RSC validation unless they are really imported by a provider module.
          if (isServerEnv) {
            enableSwcReactServerComponents(config, 'rsc-subtree')
          } else if (isClientEnv) {
            enableSwcReactServerComponents(config, 'all')
          }
        })

        // Capture dev server reference for RSC HMR socket writes
        if (api.context.action === 'dev') {
          api.onBeforeStartDevServer(({ server }) => {
            devServerRef = server
          })
        }
      }

      // ---------------------------------------------------------------
      // 8. Build ordering — client must complete before server starts
      //    so that the manifest virtual module has real client build stats.
      //    Uses rspack MultiCompiler.setDependencies() under the hood.
      //
      //    IMPORTANT: When RSC is enabled we must NOT set dependencies.
      //    The RSC Coordinator already orchestrates server↔client
      //    compilation ordering by interleaving phases within compiler
      //    hooks. Adding setDependencies(server, [client]) on top of
      //    the Coordinator creates a deadlock: MultiCompiler blocks
      //    the server compiler until client is `done`, but the
      //    Coordinator blocks the client's `make` hook until the
      //    server's entries phase completes — neither can start.
      // ---------------------------------------------------------------
      if (!rscEnabled) {
        api.onAfterCreateCompiler(({ compiler }) => {
          // MultiCompiler has a `compilers` array; single compiler does not
          if ('compilers' in compiler) {
            for (const environmentName of startCompilerServerEnvironmentNames) {
              const serverCompiler = compiler.compilers.find(
                (c) => c.name === environmentName,
              )
              if (serverCompiler) {
                const dependencies: Array<string> = [
                  RSBUILD_ENVIRONMENT_NAMES.client,
                ]
                if (
                  environmentName === RSBUILD_ENVIRONMENT_NAMES.server &&
                  serverFnProviderEnv !== RSBUILD_ENVIRONMENT_NAMES.server
                ) {
                  dependencies.push(serverFnProviderEnv)
                }

                compiler.setDependencies(serverCompiler, dependencies)
              }
            }
          }
        })
      }

      // ---------------------------------------------------------------
      // 8b. Manifest asset replacement fallback (RSC build only)
      //     Rsbuild's native RSC coordinator interleaves server and client
      //     compilers, so the server manifest module can compile before Start's
      //     normalized client build stats exist. Keep final replacement in the
      //     server asset pipeline, after the client processAssets capture has a
      //     chance to run.
      // ---------------------------------------------------------------
      if (api.context.action !== 'dev' && rscEnabled) {
        const manifestPlaceholderLiteral = JSON.stringify(
          START_MANIFEST_PLACEHOLDER,
        )
        api.modifyRspackConfig((config, utils) => {
          if (utils.environment.name !== RSBUILD_ENVIRONMENT_NAMES.server)
            return

          config.plugins.push({
            apply(compiler: RspackCompiler) {
              compiler.hooks.compilation.tap(
                'TanStackStartManifestReplace',
                (compilation: RspackCompilationExtended) => {
                  compilation.hooks.processAssets.tap(
                    {
                      name: 'TanStackStartManifestReplace',
                      stage:
                        utils.rspack.Compilation
                          .PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
                    },
                    () => {
                      let assetsWithPlaceholder:
                        | Array<{ asset: RspackAsset; sourceStr: string }>
                        | undefined

                      for (const asset of compilation.getAssets()) {
                        if (!asset.name.endsWith('.js')) {
                          continue
                        }

                        const sourceStr = String(asset.source.source())
                        if (!sourceStr.includes(manifestPlaceholderLiteral)) {
                          continue
                        }

                        if (!assetsWithPlaceholder) {
                          assetsWithPlaceholder = []
                        }
                        assetsWithPlaceholder.push({
                          asset,
                          sourceStr,
                        })
                      }

                      if (!assetsWithPlaceholder) {
                        return
                      }

                      const clientBuild = getClientBuild()
                      if (!clientBuild) {
                        throw new Error(
                          'TanStack Start could not replace the rsbuild RSC server manifest placeholder because the client build was unavailable',
                        )
                      }

                      const manifestValueLiteral =
                        virtualModuleState.generateManifestValueLiteral(
                          clientBuild,
                        )

                      for (const {
                        asset,
                        sourceStr,
                      } of assetsWithPlaceholder) {
                        compilation.updateAsset(
                          asset.name,
                          new utils.rspack.sources.RawSource(
                            sourceStr.replace(
                              manifestPlaceholderLiteral,
                              manifestValueLiteral,
                            ),
                          ),
                        )
                      }
                    },
                  )
                },
              )
            },
          })
        })
      }

      // ---------------------------------------------------------------
      // 9. After client env compiles — refresh resolver + manifest
      // ---------------------------------------------------------------
      api.onAfterEnvironmentCompile(({ environment }) => {
        if (environment.name !== RSBUILD_ENVIRONMENT_NAMES.client) return

        virtualModuleState.updateServerFnResolver()

        const clientBuild = getClientBuild()
        if (clientBuild) {
          virtualModuleState.updateManifest(clientBuild)
        }
      })

      if (api.context.action === 'build') {
        api.onAfterBuild(async () => {
          const { startConfig } = getConfig()

          await postBuildWithRsbuild({
            startConfig,
            clientOutputDirectory: resolvedStartConfig.outputDirectories.client,
            serverOutputDirectory: resolvedStartConfig.outputDirectories.server,
          })
        })
      }
    },
  }
}

const defaultRspackWatchIgnored = /[\\/](?:\.git|node_modules)[\\/]/

function seedResolveModules(
  config: RspackConfig,
  entries: Array<string>,
): void {
  const resolveModules = (config.resolve.modules ??= [])

  for (const entry of entries) {
    if (!resolveModules.includes(entry)) {
      resolveModules.push(entry)
    }
  }
}

function rebuildModulesContaining(
  compilation: RspackCompilationExtended,
  identifierFragment: string,
): Promise<void> {
  const rebuilds: Array<Promise<void>> = []
  for (const mod of compilation.modules) {
    if (!mod.identifier().includes(identifierFragment)) {
      continue
    }

    rebuilds.push(
      new Promise<void>((resolve, reject) => {
        compilation.rebuildModule(mod, (err: Error | null) => {
          if (err) reject(err)
          else resolve()
        })
      }),
    )
  }

  return rebuilds.length === 0
    ? Promise.resolve()
    : Promise.all(rebuilds).then(() => undefined)
}

/**
 * Return the realpath of every packages/<name>/dist directory in the
 * TanStack Router monorepo. Only meaningful when called from inside the
 * monorepo — in user apps, callers should guard with
 * `isInsideRouterMonoRepo` before invoking this.
 */
function resolveWorkspacePackageDistRealpaths(): Array<string> {
  // currentDir points at either <repo>/packages/start-plugin-core/src/rsbuild
  // or <repo>/packages/start-plugin-core/dist/<fmt>/rsbuild. Four levels up
  // lands on <repo>/packages in both layouts.
  const packagesDir = resolve(currentDir, '../../../../')
  if (!existsSync(packagesDir)) return []

  let entries: Array<string>
  try {
    entries = readdirSync(packagesDir)
  } catch {
    return []
  }

  const dists: Array<string> = []
  for (const entry of entries) {
    const distPath = join(packagesDir, entry, 'dist')
    try {
      if (!statSync(distPath).isDirectory()) continue
    } catch {
      continue
    }
    try {
      dists.push(realpathSync(distPath))
    } catch {
      dists.push(distPath)
    }
  }

  return dists
}
