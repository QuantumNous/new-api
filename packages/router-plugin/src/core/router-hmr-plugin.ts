import { generateFromAst, logDiff, parseAst } from '@tanstack/router-utils'
import { compileCodeSplitReferenceRoute } from './code-splitter/compilers'
import { getReferenceRouteCompilerPlugins } from './code-splitter/plugins/framework-plugins'
import { createRouteHmrStatement } from './hmr'
import { debug, normalizePath, routeFactoryCallCodeFilter } from './utils'
import { getConfig } from './config'
import { createRouterPluginContext } from './router-plugin-context'
import type { UnpluginFactory } from 'unplugin'
import type { Config } from './config'
import type { RouterPluginContext } from './router-plugin-context'

/**
 * This plugin adds HMR support for file routes.
 * It is only added to the composed plugin in dev when autoCodeSplitting is disabled, since the code splitting plugin
 * handles HMR for code-split routes itself.
 */

export function createRouterHmrPlugin(
  options: Partial<Config | (() => Config)> | undefined = {},
  routerPluginContext: RouterPluginContext,
): ReturnType<UnpluginFactory<Partial<Config> | undefined>> {
  let ROOT: string = process.cwd()

  const resolveUserConfig = () => {
    return getConfig(typeof options === 'function' ? options() : options, ROOT)
  }

  let userConfig = resolveUserConfig()

  return {
    name: 'tanstack-router:hmr',
    enforce: 'pre',
    transform: {
      filter: {
        // this is necessary for webpack / rspack to avoid matching .html files
        id: /\.(m|c)?(j|t)sx?$/,
        code: {
          include: routeFactoryCallCodeFilter,
        },
      },
      handler(code, id) {
        const normalizedId = normalizePath(id)
        const routeEntry = routerPluginContext.routesByFile.get(normalizedId)
        if (!routeEntry) {
          return null
        }

        if (debug) console.info('Adding HMR handling to route ', normalizedId)

        const hmrStyle = userConfig.plugin?.hmr?.style ?? 'vite'

        if (userConfig.target === 'react') {
          const compilerPlugins = getReferenceRouteCompilerPlugins({
            targetFramework: 'react',
            addHmr: true,
            hmrStyle,
          })
          const compiled = compileCodeSplitReferenceRoute({
            code,
            filename: normalizedId,
            id: normalizedId,
            addHmr: true,
            hmrStyle,
            hmrRouteId: routeEntry.routeId,
            codeSplitGroupings: [],
            targetFramework: 'react',
            compilerPlugins,
          })

          if (compiled) {
            if (debug) {
              logDiff(code, compiled.code)
              console.log('Output:\n', compiled.code + '\n\n')
            }

            return compiled
          }
        }

        const ast = parseAst({ code, filename: normalizedId })
        ast.program.body.push(
          ...createRouteHmrStatement([], {
            hmrStyle,
            targetFramework: userConfig.target,
            routeId: routeEntry.routeId,
          }),
        )
        const result = generateFromAst(ast, {
          sourceMaps: true,
          filename: normalizedId,
          sourceFileName: normalizedId,
        })
        if (debug) {
          logDiff(code, result.code)
          console.log('Output:\n', result.code + '\n\n')
        }
        return result
      },
    },
    vite: {
      configResolved(config) {
        ROOT = config.root
        userConfig = resolveUserConfig()
      },
      applyToEnvironment(environment) {
        if (userConfig.plugin?.vite?.environmentName) {
          return userConfig.plugin.vite.environmentName === environment.name
        }
        return true
      },
    },
  }
}

export const unpluginRouterHmrFactory: UnpluginFactory<
  Partial<Config> | undefined
> = (options = {}) => {
  return createRouterHmrPlugin(options, createRouterPluginContext())
}
