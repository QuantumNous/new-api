import { AsyncLocalStorage } from 'node:async_hooks'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { TRANSFORM_ID_REGEX } from '../constants'
import { detectKindsInCode } from '../start-compiler/compiler'
import { getTransformCodeFilterForEnv } from '../start-compiler/config'
import {
  createStartCompiler,
  loadCompilerVirtualModule,
  matchesCodeFilters,
  mergeServerFnsById,
} from '../start-compiler/host'
import { cleanId } from '../start-compiler/utils'
import { createHydrateCompilerPlugin } from '../hydrate-when-transform'
import {
  SERVER_FN_BUILD_INFO_CONTEXT_KEY,
  SERVER_FN_BUILD_INFO_FIELD,
} from './start-compiler-metadata'
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
import type {
  ServerFnBuildInfo,
  ServerFnBuildInfoLoaderContext,
} from './start-compiler-metadata'
import type {
  CompileStartFrameworkOptions,
  StartCompilerImportTransform,
  StartCompilerPlugin,
  StartCompilerTransformResult,
} from '../types'
import type {
  DevServerFnModuleSpecifierEncoder,
  GenerateFunctionIdFnOptional,
  ServerFn,
} from '../start-compiler/types'

type RsbuildTransformContext = Parameters<
  Parameters<RsbuildPluginAPI['transform']>[1]
>[0]
type WarnableRsbuildTransformContext = RsbuildTransformContext & {
  emitWarning?: (warning: Error) => void
}
type RsbuildInputFileSystem = NonNullable<Rspack.Compiler['inputFileSystem']>
type ServerFnMetadataById = Map<string, ServerFnBuildInfo>
type StartCompilerEnvironment = {
  name: string
  type: 'client' | 'server'
}

const serverFnSchema = z.object({
  functionName: z.string(),
  functionId: z.string(),
  extractedFilename: z.string(),
  filename: z.string(),
  isClientReferenced: z.boolean().optional(),
})

const serverFnBuildInfoSchema = z.object({
  version: z.literal(1),
  serverFnsById: z.record(z.string(), serverFnSchema),
})

/**
 * In Rsbuild dev, use file:// URLs for absolute server function paths.
 * These are directly importable by Node's ESM VM runner without any bundler
 * path conventions (unlike Vite's /@id/ prefix).
 */
const rsbuildDevServerFnModuleSpecifierEncoder: DevServerFnModuleSpecifierEncoder =
  ({ extractedFilename }) => pathToFileURL(extractedFilename).href

const currentDir = dirname(fileURLToPath(import.meta.url))
const metadataLoaderFilename = 'start-compiler-metadata-loader.js'
const EMPTY_SERVER_FN_BUILD_INFO: ServerFnBuildInfo = {
  version: 1,
  serverFnsById: {},
}

function resolveMetadataLoader(): string {
  return resolve(currentDir, metadataLoaderFilename)
}

function readServerFnBuildInfo(
  module: Rspack.Module,
): Record<string, ServerFn> | null {
  const result = serverFnBuildInfoSchema.safeParse(
    module.buildInfo[SERVER_FN_BUILD_INFO_FIELD],
  )
  if (!result.success) {
    return null
  }

  return result.data.serverFnsById
}

function setServerFnBuildInfoLoaderContext(
  loaderContext: Rspack.LoaderContext & ServerFnBuildInfoLoaderContext,
  module: Rspack.Module,
) {
  loaderContext[SERVER_FN_BUILD_INFO_CONTEXT_KEY] = (metadata) => {
    if (metadata) {
      module.buildInfo[SERVER_FN_BUILD_INFO_FIELD] = metadata
    } else if (module.buildInfo[SERVER_FN_BUILD_INFO_FIELD]) {
      module.buildInfo[SERVER_FN_BUILD_INFO_FIELD] = EMPTY_SERVER_FN_BUILD_INFO
    }
  }
}

function warnTransformContext(
  ctx: WarnableRsbuildTransformContext,
  message: string,
): void {
  ctx.emitWarning?.(new Error(message))
}

export interface StartCompilerHostOptions {
  framework: CompileStartFrameworkOptions
  root: string | (() => string)
  environments: Array<StartCompilerEnvironment>
  providerEnvName: string
  generateFunctionId?: GenerateFunctionIdFnOptional
  compilerTransforms?: Array<StartCompilerImportTransform> | undefined
  compilerPlugins?: Array<StartCompilerPlugin> | undefined
  serverFnProviderModuleDirectives?: ReadonlyArray<string> | undefined
  serverFnsById?: Record<string, ServerFn>
  onServerFnsByIdChange?: () => void
}

/**
 * Registers the shared StartCompiler as rsbuild transforms for client + ssr environments.
 *
 * Uses `api.transform()` to hook into the rsbuild loader pipeline, and the
 * transform context's native `resolve()` for module resolution.
 */
export function registerStartCompilerTransforms(
  api: RsbuildPluginAPI,
  opts: StartCompilerHostOptions,
): {
  serverFnsById: Record<string, ServerFn>
} {
  const compilers = new Map<string, ReturnType<typeof createStartCompiler>>()
  // Serialize access to each StartCompiler's mutable per-environment caches.
  const compilerQueues = new Map<string, Promise<void>>()
  const inputFileSystems = new Map<string, RsbuildInputFileSystem>()
  const transformContextStorage =
    new AsyncLocalStorage<RsbuildTransformContext>()
  const serverFnMetadataByEnvironment = new Map<string, ServerFnMetadataById>()
  const serverFnsByEnvironment = new Map<string, Record<string, ServerFn>>()
  const serverFnsById = opts.serverFnsById ?? {}
  const getRoot = () =>
    typeof opts.root === 'function' ? opts.root() : opts.root
  const getServerFnMetadata = (environmentName: string) => {
    let metadataById = serverFnMetadataByEnvironment.get(environmentName)

    if (!metadataById) {
      metadataById = new Map()
      serverFnMetadataByEnvironment.set(environmentName, metadataById)
    }

    return metadataById
  }
  const runCompilerTask = async <T>(
    environmentName: string,
    task: () => Promise<T>,
  ): Promise<T> => {
    const previous = compilerQueues.get(environmentName) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)

    compilerQueues.set(
      environmentName,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )

    return next
  }

  const replaceServerFnsByIdFromEnvironmentSnapshots = () => {
    const nextServerFnsById: Record<string, ServerFn> = {}

    for (const snapshot of serverFnsByEnvironment.values()) {
      mergeServerFnsById(nextServerFnsById, snapshot)
    }

    for (const key of Object.keys(serverFnsById)) {
      delete serverFnsById[key]
    }

    Object.assign(serverFnsById, nextServerFnsById)
    opts.onServerFnsByIdChange?.()
  }
  const compilerPlugins = [
    createHydrateCompilerPlugin(),
    ...(opts.compilerPlugins ?? []),
  ]

  const isDev = api.context.action === 'dev'
  const mode = isDev ? 'dev' : 'build'
  const metadataLoader = resolveMetadataLoader()

  const environments = opts.environments

  // Rspack persistent cache restores modules without re-running api.transform.
  // Keep server function modules cacheable by writing discovered metadata into
  // buildInfo from a real loader, then replaying it from cached modules.
  api.modifyRspackConfig((config, utils) => {
    if (!environments.some((env) => env.name === utils.environment.name)) {
      return
    }

    const rules = config.module.rules ?? []
    rules.push({
      test: TRANSFORM_ID_REGEX[0],
      enforce: 'post',
      use: [
        {
          loader: metadataLoader,
          options: {
            metadataById: getServerFnMetadata(utils.environment.name),
          },
        },
      ],
    })
    config.module.rules = rules
  })

  for (const env of environments) {
    const compilerTransforms =
      env.name === opts.providerEnvName ? opts.compilerTransforms : undefined
    const envCodeFilters = getTransformCodeFilterForEnv(env.type, {
      compilerTransforms,
      compilerPlugins,
    })
    const serverFnProviderModuleDirectives =
      env.name === opts.providerEnvName
        ? opts.serverFnProviderModuleDirectives
        : undefined
    let activeServerFnMetadata: Record<string, ServerFn> | undefined
    const onServerFnsById = (d: Record<string, ServerFn>) => {
      mergeServerFnsById(serverFnsById, d)

      if (activeServerFnMetadata) {
        mergeServerFnsById(activeServerFnMetadata, d)
      }

      opts.onServerFnsByIdChange?.()
    }

    api.transform(
      {
        test: TRANSFORM_ID_REGEX[0],
        environments: [env.name],
        order: 'pre',
      },
      async (ctx: RsbuildTransformContext) => {
        return transformContextStorage.run(ctx, async () => {
          const code = ctx.code
          let nextCode = code
          let previousResult: {
            code: string
            map: StartCompilerTransformResult['map']
          } | null = null
          const id = ctx.resource
          const root = getRoot()

          const virtualResult = loadCompilerVirtualModule(compilerPlugins, {
            code,
            id,
            root,
            env: env.type,
            envName: env.name,
          })
          if (virtualResult) {
            nextCode = virtualResult.code
            previousResult = {
              code: virtualResult.code,
              map: virtualResult.map ?? null,
            }
          }

          // Quick string-level check: does this file contain any patterns for this env?
          if (!matchesCodeFilters(nextCode, envCodeFilters)) {
            return previousResult ?? nextCode
          }

          let compiler = compilers.get(env.name)
          if (!compiler) {
            compiler = createStartCompiler({
              env: env.type,
              envName: env.name,
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
              encodeModuleSpecifierInDev: isDev
                ? rsbuildDevServerFnModuleSpecifierEncoder
                : undefined,
              loadModule: async (moduleId: string) => {
                const activeCtx = transformContextStorage.getStore()
                if (!activeCtx) {
                  throw new Error(
                    `could not load module ${moduleId}: missing active rsbuild transform context for ${env.name}`,
                  )
                }

                const inputFileSystem = inputFileSystems.get(env.name)
                if (!inputFileSystem) {
                  throw new Error(
                    `could not load module ${moduleId}: missing rspack input filesystem for ${env.name}`,
                  )
                }

                const cleanedId = cleanId(moduleId)
                activeCtx.addDependency(cleanedId)
                const loaded = await readFileFromInputFileSystem(
                  inputFileSystem,
                  cleanedId,
                )
                const moduleCode = Buffer.isBuffer(loaded)
                  ? loaded.toString('utf8')
                  : loaded

                compiler!.ingestModule({ code: moduleCode, id: cleanedId })
              },
              resolveId: async (
                source: string,
                importer?: string,
              ): Promise<string | null> => {
                const activeCtx = transformContextStorage.getStore()
                if (!activeCtx) {
                  throw new Error(
                    `could not resolve ${source}: missing active rsbuild transform context for ${env.name}`,
                  )
                }

                const context = importer
                  ? importer.replace(/[/\\][^/\\]*$/, '')
                  : getRoot()

                return await new Promise((resolve, reject) => {
                  activeCtx.resolve(context, source, (error, resolved) => {
                    if (error) {
                      reject(error)
                      return
                    }

                    if (!resolved) {
                      resolve(null)
                      return
                    }

                    resolve(cleanId(resolved))
                  })
                })
              },
            })
            compilers.set(env.name, compiler)
          }

          const detectedKinds = detectKindsInCode(nextCode, env.type, {
            compilerTransforms,
          })
          const discoveredServerFnsById: Record<string, ServerFn> = {}
          const result = await runCompilerTask(env.name, async () => {
            activeServerFnMetadata = discoveredServerFnsById

            try {
              return await compiler.compile({
                id,
                code: nextCode,
                detectedKinds,
                warn: (message) => warnTransformContext(ctx, message),
              })
            } finally {
              activeServerFnMetadata = undefined
            }
          })

          getServerFnMetadata(env.name).set(id, {
            version: 1,
            serverFnsById: discoveredServerFnsById,
          })

          if (result) {
            return {
              code: result.code,
              map: result.map ?? null,
            }
          }

          return previousResult ?? nextCode
        })
      },
    )
  }

  api.modifyRspackConfig((config, utils) => {
    if (!environments.some((env) => env.name === utils.environment.name)) {
      return
    }

    config.plugins.push({
      apply(compiler: Rspack.Compiler) {
        if (compiler.inputFileSystem) {
          inputFileSystems.set(utils.environment.name, compiler.inputFileSystem)
        }

        compiler.hooks.compilation.tap(
          'TanStackStartCompilerMetadataLoaderContext',
          (compilation) => {
            utils.rspack.NormalModule.getCompilationHooks(
              compilation,
            ).loader.tap(
              'TanStackStartCompilerMetadataLoaderContext',
              (loaderContext, module) => {
                setServerFnBuildInfoLoaderContext(loaderContext, module)
              },
            )
          },
        )

        compiler.hooks.compile.tap('TanStackStartCompilerMetadataCleanup', () =>
          getServerFnMetadata(utils.environment.name).clear(),
        )

        compiler.hooks.finishMake.tap(
          {
            name: 'TanStackStartCompilerCachedServerFnMetadata',
            stage: -20,
          },
          (compilation) => {
            const restoredServerFnsById: Record<string, ServerFn> = {}

            for (const module of compilation.modules) {
              const metadata = readServerFnBuildInfo(module)
              if (!metadata) {
                continue
              }

              mergeServerFnsById(restoredServerFnsById, metadata)
            }

            serverFnsByEnvironment.set(
              utils.environment.name,
              restoredServerFnsById,
            )
            replaceServerFnsByIdFromEnvironmentSnapshots()
          },
        )

        compiler.hooks.watchRun.tap(
          'TanStackStartCompilerModuleInvalidation',
          (watchCompiler) => {
            const startCompiler = compilers.get(utils.environment.name)

            if (!startCompiler) {
              return
            }

            for (const file of watchCompiler.modifiedFiles ?? []) {
              startCompiler.invalidateModule(file)
            }

            for (const file of watchCompiler.removedFiles ?? []) {
              startCompiler.invalidateModule(file)
            }
          },
        )
      },
    })
  })

  return { serverFnsById }
}

function readFileFromInputFileSystem(
  inputFileSystem: RsbuildInputFileSystem,
  file: string,
): Promise<string | Buffer> {
  return new Promise((resolve, reject) => {
    inputFileSystem.readFile(file, (error, data) => {
      if (error) {
        reject(error)
        return
      }

      if (data == null) {
        reject(new Error(`could not read module source for ${file}`))
        return
      }

      resolve(data)
    })
  })
}
