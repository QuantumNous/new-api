import { VIRTUAL_MODULES } from '@tanstack/start-server-core'
import { resolve as resolvePath } from 'pathe'
import {
  SERVER_FN_LOOKUP,
  TRANSFORM_ID_REGEX,
  VITE_ENVIRONMENT_NAMES,
} from '../../constants'
import { detectKindsInCode } from '../../start-compiler/compiler'
import { getTransformCodeFilterForEnv } from '../../start-compiler/config'
import {
  createCompilerVirtualModuleIdPattern,
  createStartCompiler,
  loadCompilerVirtualModule,
  mergeServerFnsById,
} from '../../start-compiler/host'
import { generateServerFnResolverModule } from '../../start-compiler/server-fn-resolver-module'
import { cleanId } from '../../start-compiler/utils'
import { createVirtualModule } from '../createVirtualModule'
import {
  MissingHydrateSourceError,
  createHydrateCompilerPlugin,
} from '../../hydrate-when-transform'
import { resolveViteId } from '../../utils'
import {
  createViteDevServerFnModuleSpecifierEncoder,
  decodeViteDevServerModuleSpecifier,
} from './module-specifier'
import { mergeHotUpdateModules } from './hot-update'
import type {
  CompileStartFrameworkOptions,
  StartCompilerImportTransform,
  StartCompilerPlugin,
} from '../../types'
import type {
  GenerateFunctionIdFnOptional,
  ServerFn,
} from '../../start-compiler/types'
import type { Environment, EnvironmentModuleNode, PluginOption } from 'vite'

// Re-export from shared constants for backwards compatibility
export { SERVER_FN_LOOKUP }

const validateServerFnIdVirtualModule = `virtual:tanstack-start-validate-server-fn-id`
const TSS_SERVERFN_SPLIT_PARAM = 'tss-serverfn-split'

type ModuleInvalidationEnvironment = {
  moduleGraph: {
    getModulesByFile: (file: string) => Set<EnvironmentModuleNode> | undefined
    invalidateModule: (
      mod: EnvironmentModuleNode,
      seen?: Set<EnvironmentModuleNode>,
    ) => void
  }
}

type ViteModuleLoadOptions = {
  devId?: string
  load: (options: { id: string }) => Promise<{ code?: string | null } | null>
  error: (message: string) => never
}

async function loadViteModuleFromEnvironment(
  environment: Environment,
  id: string,
  opts: ViteModuleLoadOptions,
): Promise<string | undefined> {
  if (environment.mode === 'build') {
    const loaded = await opts.load({ id })
    return loaded?.code ?? ''
  }

  if (environment.mode === 'dev') {
    await environment.transformRequest(opts.devId ?? id)
    return undefined
  }

  opts.error(
    `could not load module ${id}: unknown environment mode ${environment.mode}`,
  )
}

function invalidateMatchingFileModules(
  environment: ModuleInvalidationEnvironment,
  ids: Iterable<string>,
  shouldInvalidate: (mod: EnvironmentModuleNode) => boolean,
) {
  const seen = new Set<EnvironmentModuleNode>()
  const invalidatedModules: Array<EnvironmentModuleNode> = []

  for (const id of ids) {
    const fileModules = environment.moduleGraph.getModulesByFile(cleanId(id))

    if (!fileModules) {
      continue
    }

    for (const fileModule of fileModules) {
      if (!shouldInvalidate(fileModule)) {
        continue
      }

      environment.moduleGraph.invalidateModule(fileModule, seen)
      invalidatedModules.push(fileModule)
    }
  }

  return invalidatedModules
}

function invalidateServerFnProviderModules(
  environment: {
    moduleGraph: {
      getModulesByFile: (file: string) => Set<EnvironmentModuleNode> | undefined
      invalidateModule: (
        mod: EnvironmentModuleNode,
        seen?: Set<EnvironmentModuleNode>,
      ) => void
    }
  },
  ids: Iterable<string>,
) {
  return invalidateMatchingFileModules(
    environment,
    ids,
    (fileModule) => fileModule.id?.includes(TSS_SERVERFN_SPLIT_PARAM) ?? false,
  )
}

function invalidateServerFnLookupModules(
  environment: ModuleInvalidationEnvironment,
  ids: Iterable<string>,
) {
  invalidateMatchingFileModules(
    environment,
    ids,
    (fileModule) => fileModule.id?.includes(SERVER_FN_LOOKUP) ?? false,
  )
}

function invalidateCompilerVirtualModules(
  environment: ModuleInvalidationEnvironment,
  ids: Iterable<string>,
  pattern: RegExp | undefined,
) {
  if (!pattern) {
    return []
  }

  return invalidateMatchingFileModules(environment, ids, (fileModule) => {
    if (!fileModule.id) {
      return false
    }

    pattern.lastIndex = 0
    return pattern.test(fileModule.id)
  })
}

function getServerFnProviderIds(ids: Iterable<string>) {
  const providerIds = new Set<string>()

  for (const id of ids) {
    const cleanedId = cleanId(id)
    providerIds.add(`${cleanedId}?${TSS_SERVERFN_SPLIT_PARAM}`)
  }

  return providerIds
}

function invalidateModuleNodes(
  environment: {
    moduleGraph: {
      invalidateModule: (
        mod: EnvironmentModuleNode,
        seen?: Set<EnvironmentModuleNode>,
      ) => void
    }
  },
  modules: Iterable<EnvironmentModuleNode>,
) {
  const seen = new Set<EnvironmentModuleNode>()

  for (const mod of modules) {
    environment.moduleGraph.invalidateModule(mod, seen)
  }
}

function getDevServerFnValidatorModule(): string {
  return `
export async function getServerFnById(id, _access) {
  const validateIdImport = ${JSON.stringify(validateServerFnIdVirtualModule)} + '?id=' + id
  await import(/* @vite-ignore */ '/@id/__x00__' + validateIdImport)
  const decoded = Buffer.from(id, 'base64url').toString('utf8')
  const devServerFn = JSON.parse(decoded)
  const mod = await import(/* @vite-ignore */ devServerFn.file)
  return mod[devServerFn.export]
}
`
}

function parseIdQuery(id: string): {
  filename: string
  query: {
    [k: string]: string
  }
} {
  if (!id.includes('?')) return { filename: id, query: {} }
  const [filename, rawQuery] = id.split(`?`, 2) as [string, string]
  const query = Object.fromEntries(new URLSearchParams(rawQuery))
  return { filename, query }
}

export interface StartCompilerPluginOptions {
  framework: CompileStartFrameworkOptions
  environments: Array<{
    name: string
    type: 'client' | 'server'
    getServerFnById?: string
  }>
  /**
   * Custom function ID generator (optional).
   */
  generateFunctionId?: GenerateFunctionIdFnOptional
  compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  compilerPlugins?: Array<StartCompilerPlugin> | undefined
  serverFnProviderModuleDirectives?: ReadonlyArray<string> | undefined
  /**
   * The Vite environment name for the server function provider.
   */
  providerEnvName: string
}

export function startCompilerPlugin(
  opts: StartCompilerPluginOptions,
): PluginOption {
  const compilers = new Map<string, ReturnType<typeof createStartCompiler>>()
  const compilerPlugins = [
    createHydrateCompilerPlugin(),
    ...(opts.compilerPlugins ?? []),
  ]
  const compilerVirtualModuleIdPattern =
    createCompilerVirtualModuleIdPattern(compilerPlugins)
  const environmentByName = new Map(
    opts.environments.map((environment) => [environment.name, environment]),
  )

  // Shared registry of server functions across all environments
  const serverFnsById: Record<string, ServerFn> = {}

  const onServerFnsById = (d: Record<string, ServerFn>) => {
    mergeServerFnsById(serverFnsById, d)
  }

  let root = process.cwd()
  let bundledDev = false
  // Determine which environments need the resolver (getServerFnById)
  // SSR environment always needs the resolver for server-side calls
  // Provider environment needs it for the actual implementation
  const ssrEnvName = VITE_ENVIRONMENT_NAMES.server

  // SSR is the provider when the provider environment is the default server environment
  const ssrIsProvider = opts.providerEnvName === ssrEnvName

  // Environments that need the resolver: SSR (for server calls) and provider (for implementation)
  const appliedResolverEnvironments = new Set(
    ssrIsProvider ? [opts.providerEnvName] : [ssrEnvName, opts.providerEnvName],
  )

  function perEnvServerFnPlugin(environment: {
    name: string
    type: 'client' | 'server'
  }): PluginOption {
    const compilerTransforms =
      environment.name === opts.providerEnvName
        ? opts.compilerTransforms
        : undefined
    const serverFnProviderModuleDirectives =
      environment.name === opts.providerEnvName
        ? opts.serverFnProviderModuleDirectives
        : undefined
    // Derive transform code filter from KindDetectionPatterns (single source of truth)
    const transformCodeFilter = getTransformCodeFilterForEnv(environment.type, {
      compilerTransforms,
      compilerPlugins,
    })
    return {
      name: `tanstack-start-core::server-fn:${environment.name}`,
      enforce: 'pre',
      applyToEnvironment(env) {
        return env.name === environment.name
      },
      configResolved(config) {
        root = config.root
        bundledDev = !!config.experimental.bundledDev
      },
      buildStart() {
        if (
          this.environment.mode === 'build' ||
          (bundledDev &&
            this.environment.name === VITE_ENVIRONMENT_NAMES.client)
        ) {
          // Vite app builds can run multiple Rolldown build phases with fresh
          // plugin drivers. The compiler host closes over this hook context for
          // load/resolve, so do not reuse it after a previous driver was closed.
          compilers.delete(this.environment.name)
        }
      },
      watchChange(id) {
        if (bundledDev && this.environment.mode === 'dev') {
          compilers.get(this.environment.name)?.invalidateModule(id)
        }
      },
      transform: {
        filter: {
          id: {
            exclude: new RegExp(`${SERVER_FN_LOOKUP}$`),
            include: TRANSFORM_ID_REGEX,
          },
          code: {
            include: transformCodeFilter,
          },
        },
        async handler(code, id) {
          let compiler = compilers.get(this.environment.name)

          if (!compiler) {
            // Default to 'dev' mode for unknown environments (conservative: no caching)
            const mode = this.environment.mode === 'build' ? 'build' : 'dev'

            compiler = createStartCompiler({
              env: environment.type,
              envName: environment.name,
              root,
              mode,
              framework: opts.framework,
              providerEnvName: opts.providerEnvName,
              generateFunctionId: opts.generateFunctionId,
              compilerTransforms,
              compilerPlugins,
              serverFnProviderModuleDirectives,
              onServerFnsById,
              getKnownServerFns: () => serverFnsById,
              encodeModuleSpecifierInDev:
                mode === 'dev'
                  ? createViteDevServerFnModuleSpecifierEncoder(root)
                  : undefined,
              loadModule: async (id: string) => {
                const code = await loadViteModuleFromEnvironment(
                  this.environment,
                  id,
                  {
                    load: (options) => this.load(options),
                    error: (message) => this.error(message),
                    devId: `${id}?${SERVER_FN_LOOKUP}`,
                  },
                )
                if (code !== undefined) {
                  compiler!.ingestModule({ code, id })
                }
              },

              resolveId: async (source: string, importer?: string) => {
                const r = await this.resolve(source, importer)

                if (r) {
                  if (!r.external) {
                    return cleanId(r.id)
                  }
                }

                return null
              },
            })

            compilers.set(this.environment.name, compiler)
          }

          // Detect which kinds are present in this file before parsing
          const detectedKinds = detectKindsInCode(code, environment.type, {
            compilerTransforms,
          })

          const result = await compiler.compile({
            id,
            code,
            detectedKinds,
            warn: (message) => this.warn(message),
          })

          return result
        },
      },

      hotUpdate(ctx) {
        const compiler = compilers.get(this.environment.name)
        const idsToInvalidate = new Set<string>()
        const transitiveCompilerImportersToInvalidate = new Set<string>()
        const importerModulesToInvalidate = new Set<EnvironmentModuleNode>()
        const changedIds: Array<string> = []

        ctx.modules.forEach((m) => {
          if (m.id) {
            idsToInvalidate.add(m.id)
            changedIds.push(m.id)
          }
        })

        const deletedIds = compiler?.invalidateModules(changedIds) ?? new Set()

        ctx.modules.forEach((m) => {
          if (m.id) {
            if (deletedIds.has(cleanId(m.id))) {
              transitiveCompilerImportersToInvalidate.add(cleanId(m.id))

              m.importers.forEach((importer) => {
                if (importer.id) {
                  idsToInvalidate.add(importer.id)
                  importerModulesToInvalidate.add(importer)
                  transitiveCompilerImportersToInvalidate.add(
                    cleanId(importer.id),
                  )
                }
              })
            }
          }
        })

        const finishHotUpdate = async () => {
          if (
            environment.type === 'server' &&
            compiler &&
            transitiveCompilerImportersToInvalidate.size > 0
          ) {
            const seenImporters = new Set(
              transitiveCompilerImportersToInvalidate,
            )
            const nestedImporters =
              await compiler.getTransitiveImporters(seenImporters)

            for (const nestedImporterId of nestedImporters) {
              seenImporters.add(nestedImporterId)
            }

            for (const importerId of seenImporters) {
              idsToInvalidate.add(importerId)
            }
            compiler.invalidateModules(seenImporters)
          }

          invalidateModuleNodes(this.environment, importerModulesToInvalidate)
          invalidateServerFnLookupModules(this.environment, idsToInvalidate)
          const compilerVirtualModules = invalidateCompilerVirtualModules(
            this.environment,
            idsToInvalidate,
            compilerVirtualModuleIdPattern,
          )

          if (environment.type !== 'server') {
            return mergeHotUpdateModules(ctx.modules, compilerVirtualModules)
          }

          invalidateModuleNodes(this.environment, ctx.modules)

          const providerIdsToInvalidate =
            getServerFnProviderIds(idsToInvalidate)
          compiler?.invalidateModules(providerIdsToInvalidate)

          const providerModules = invalidateServerFnProviderModules(
            this.environment,
            [...idsToInvalidate, ...providerIdsToInvalidate],
          )

          return mergeHotUpdateModules(ctx.modules, [
            ...compilerVirtualModules,
            ...providerModules,
          ])
        }

        return finishHotUpdate()
      },
    }
  }

  return [
    ...opts.environments.map(perEnvServerFnPlugin),
    {
      name: 'tanstack-start-core:capture-server-fn-module-lookup',
      // we only need this plugin in dev mode
      apply: 'serve',
      applyToEnvironment(env) {
        return !!opts.environments.find((e) => e.name === env.name)
      },
      transform: {
        filter: {
          id: new RegExp(`${SERVER_FN_LOOKUP}$`),
        },
        handler(code, id) {
          const compiler = compilers.get(this.environment.name)
          compiler?.ingestModule({ code, id: cleanId(id) })
        },
      },
    },
    {
      name: 'tanstack-start-core:compiler-virtual-module',
      enforce: 'pre',
      load: {
        filter: {
          id: compilerVirtualModuleIdPattern ?? /$^/,
        },
        async handler(id) {
          const environment = environmentByName.get(this.environment.name)
          if (!environment || !compilerVirtualModuleIdPattern) {
            return null
          }

          const loadVirtualModule = () =>
            loadCompilerVirtualModule(compilerPlugins, {
              id,
              root,
              env: environment.type,
              envName: this.environment.name,
            })

          try {
            return loadVirtualModule()
          } catch (error) {
            if (!(error instanceof MissingHydrateSourceError)) {
              throw error
            }
          }

          const sourceId = cleanId(id)
          await loadViteModuleFromEnvironment(this.environment, sourceId, {
            load: (options) => this.load(options),
            error: (message) => this.error(message),
          })

          return loadVirtualModule()
        },
      },
    },
    // Validate server function ID in dev mode
    {
      name: 'tanstack-start-core:validate-server-fn-id',
      apply: 'serve',
      load: {
        filter: {
          id: new RegExp(resolveViteId(validateServerFnIdVirtualModule)),
        },
        async handler(id) {
          const parsed = parseIdQuery(id)
          const fnId = parsed.query.id
          if (fnId && serverFnsById[fnId]) {
            return `export {}`
          }

          // ID not yet registered — the source file may not have been
          // transformed in this dev session yet (e.g. cold restart with
          // cached client). Try to decode the ID, discover the source
          // file, trigger its compilation, and re-check.
          if (fnId) {
            try {
              const decoded = JSON.parse(
                Buffer.from(fnId, 'base64url').toString('utf8'),
              )
              if (
                typeof decoded.file === 'string' &&
                typeof decoded.export === 'string'
              ) {
                // Use the Vite when to decode the module specifier
                // back to the original source file path.
                const sourceFile = decodeViteDevServerModuleSpecifier(
                  decoded.file,
                )

                if (sourceFile) {
                  // Resolve to absolute path
                  const absPath = resolvePath(root, sourceFile)

                  // Trigger transform of the source file in this environment,
                  // which will compile createServerFn calls and populate
                  // serverFnsById as a side effect.
                  if (this.environment.mode !== 'dev') {
                    this.error(
                      `could not validate server function ID ${fnId}: unknown environment mode ${this.environment.mode}`,
                    )
                  }

                  await this.environment.transformRequest(
                    `${absPath}?${SERVER_FN_LOOKUP}`,
                  )

                  // Re-check after lazy compilation
                  if (serverFnsById[fnId]) {
                    return `export {}`
                  }
                }
              }
            } catch {
              // Decoding or fetching failed — fall through to error
            }
          }

          this.error(`Invalid server function ID: ${fnId}`)
        },
      },
    },
    // Manifest plugin for server environments
    createVirtualModule({
      name: 'tanstack-start-core:server-fn-resolver',
      moduleId: VIRTUAL_MODULES.serverFnResolver,
      enforce: 'pre',
      applyToEnvironment: (env) => {
        return appliedResolverEnvironments.has(env.name)
      },
      load() {
        if (this.environment.name !== opts.providerEnvName) {
          const mod = opts.environments.find(
            (e) => e.name === this.environment.name,
          )?.getServerFnById
          if (mod) {
            return mod
          }

          this.error(
            `No getServerFnById implementation found for caller environment: ${this.environment.name}`,
          )
        }

        if (this.environment.mode !== 'build') {
          return getDevServerFnValidatorModule()
        }

        // When SSR is the provider, server-only-referenced functions aren't in the manifest,
        // so no isClientReferenced check is needed.
        // When SSR is NOT the provider (custom provider env), server-only-referenced
        // functions ARE in the manifest and need the isClientReferenced check to
        // block direct client HTTP requests to server-only-referenced functions.
        return generateServerFnResolverModule({
          serverFnsById,
          includeClientReferencedCheck: !ssrIsProvider,
        })
      },
    }),
  ]
}
