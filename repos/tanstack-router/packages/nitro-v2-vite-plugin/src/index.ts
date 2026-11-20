import { build, copyPublicAssets, createNitro, prepare } from 'nitropack'
import { dirname, resolve } from 'pathe'

import type { PluginOption, ResolvedConfig, Rollup } from 'vite'
import type { NitroConfig } from 'nitropack'

let ssrBundle: Rollup.OutputBundle
let ssrEntryFile: string

function isFullUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

export function nitroV2Plugin(nitroConfig?: NitroConfig): Array<PluginOption> {
  let resolvedConfig: ResolvedConfig
  return [
    {
      name: 'tanstack-nitro-v2-vite-plugin',

      generateBundle: {
        handler(_options, bundle) {
          if (this.environment.name !== 'ssr') {
            return
          }

          // find entry point of ssr bundle
          let entryFile: string | undefined
          for (const [_name, file] of Object.entries(bundle)) {
            if (file.type === 'chunk') {
              if (file.isEntry) {
                if (entryFile !== undefined) {
                  this.error(
                    `Multiple entry points found for service "${this.environment.name}". Only one entry point is allowed.`,
                  )
                }
                entryFile = file.fileName
              }
            }
          }
          if (entryFile === undefined) {
            this.error(
              `No entry point found for service "${this.environment.name}".`,
            )
          }
          ssrEntryFile = entryFile!
          ssrBundle = bundle
        },
      },

      configResolved(config) {
        resolvedConfig = config
      },
      config(_, env) {
        if (env.command !== 'build') {
          return
        }

        return {
          environments: {
            ssr: {
              consumer: 'server',
              build: {
                ssr: true,
                // we don't write to the file system as the below 'capture-output' plugin will
                // capture the output and write it to the virtual file system
                write: false,
                copyPublicDir: false,
                commonjsOptions: {
                  include: [/node_modules/],
                },
              },
            },
          },
          builder: {
            sharedPlugins: true,
            async buildApp(builder) {
              const client = builder.environments.client
              const server = builder.environments.ssr

              if (!client) {
                throw new Error('Client environment not found')
              }

              if (!server) {
                throw new Error('SSR environment not found')
              }

              await builder.build(client)
              await builder.build(server)

              const virtualEntry = '#tanstack/start/entry'
              const baseURL = !isFullUrl(resolvedConfig.base)
                ? resolvedConfig.base
                : undefined
              const config: NitroConfig = {
                baseURL,
                publicAssets: [
                  {
                    dir: client.config.build.outDir,
                    maxAge: 31536000, // 1 year
                    baseURL: '/',
                  },
                ],
                ...nitroConfig,
                esbuild: {
                  options: {
                    target: server.config.build.target || undefined,
                    ...nitroConfig?.esbuild?.options,
                  },
                },
                renderer: virtualEntry,
                rollupConfig: {
                  ...nitroConfig?.rollupConfig,
                  plugins: [virtualBundlePlugin(ssrBundle) as any],
                },
                virtual: {
                  ...nitroConfig?.virtual,
                  [virtualEntry]: `import { fromWebHandler } from 'h3'
                                    import handler from '${ssrEntryFile}' 
                                    export default fromWebHandler(handler.fetch)`,
                },
              }

              const nitro = await createNitro(config)

              await prepare(nitro)
              await copyPublicAssets(nitro)
              await build(nitro)

              await nitro.close()
            },
          },
        }
      },
    },
  ]
}

function virtualBundlePlugin(bundle: Rollup.OutputBundle): Rollup.Plugin {
  type VirtualModule = { code: string; map: string | null }
  let _modules: Map<string, VirtualModule> | null = null

  // lazy initialize _modules since at the time of plugin creation, the bundles are not available yet
  const getModules = () => {
    if (_modules) {
      return _modules
    }
    _modules = new Map()
    // group chunks and source maps
    for (const [fileName, content] of Object.entries(bundle)) {
      if (content.type === 'chunk') {
        const virtualModule: VirtualModule = {
          code: content.code,
          map: null,
        }
        const maybeMap = bundle[`${fileName}.map`]
        if (maybeMap && maybeMap.type === 'asset') {
          virtualModule.map = maybeMap.source as string
        }
        _modules.set(fileName, virtualModule)
        _modules.set(resolve(fileName), virtualModule)
      }
    }
    return _modules
  }

  return {
    name: 'virtual-bundle',
    resolveId(id, importer) {
      const modules = getModules()
      if (modules.has(id)) {
        return resolve(id)
      }

      if (importer) {
        const resolved = resolve(dirname(importer), id)
        if (modules.has(resolved)) {
          return resolved
        }
      }
      return null
    },
    load(id) {
      const modules = getModules()
      const m = modules.get(id)
      if (!m) {
        return null
      }
      return m
    },
  }
}
