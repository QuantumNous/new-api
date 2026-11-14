/**
 * It is important to familiarize yourself with how the code-splitting works in this plugin.
 * https://github.com/TanStack/router/pull/3355
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodeIdentifier, logDiff } from '@tanstack/router-utils'
import { getConfig, splitGroupingsSchema } from './config'
import {
  compileCodeSplitReferenceRoute,
  compileCodeSplitSharedRoute,
  compileCodeSplitVirtualRoute,
  computeSharedBindings,
  detectCodeSplitGroupingsFromRoute,
} from './code-splitter/compilers'
import { getReferenceRouteCompilerPlugins } from './code-splitter/plugins/framework-plugins'
import {
  defaultCodeSplitGroupings,
  splitRouteIdentNodes,
  tsrShared,
  tsrSplit,
} from './constants'
import { debug, normalizePath, routeFactoryCallCodeFilter } from './utils'
import { createRouterPluginContext } from './router-plugin-context'
import type { CodeSplitGroupings, SplitRouteIdentNodes } from './constants'
import type { GetRoutesByFileMapResultValue } from '@tanstack/router-generator'
import type { Config } from './config'
import type { RouterPluginContext } from './router-plugin-context'
import type {
  UnpluginFactory,
  TransformResult as UnpluginTransformResult,
} from 'unplugin'

const CODE_SPLITTER_PLUGIN_NAME =
  'tanstack-router:code-splitter:compile-reference-file'

type TransformationPluginInfo = {
  pluginNames: Array<string>
  pkg: string
  usage: string
}

/**
 * JSX transformation plugins grouped by framework.
 * These plugins must come AFTER the TanStack Router plugin in the Vite config.
 */
const TRANSFORMATION_PLUGINS_BY_FRAMEWORK: Record<
  string,
  Array<TransformationPluginInfo>
> = {
  react: [
    {
      // Babel-based React plugin
      pluginNames: ['vite:react-babel', 'vite:react-refresh'],
      pkg: '@vitejs/plugin-react',
      usage: 'react()',
    },
    {
      // SWC-based React plugin
      pluginNames: ['vite:react-swc', 'vite:react-swc:resolve-runtime'],
      pkg: '@vitejs/plugin-react-swc',
      usage: 'reactSwc()',
    },
    {
      // OXC-based React plugin (deprecated but should still be handled)
      pluginNames: ['vite:react-oxc:config', 'vite:react-oxc:refresh-runtime'],
      pkg: '@vitejs/plugin-react-oxc',
      usage: 'reactOxc()',
    },
  ],
  solid: [
    {
      pluginNames: ['solid'],
      pkg: 'vite-plugin-solid',
      usage: 'solid()',
    },
  ],
}

export function createRouterCodeSplitterPlugin(
  options: Partial<Config | (() => Config)> | undefined = {},
  routerPluginContext: RouterPluginContext,
): ReturnType<UnpluginFactory<Partial<Config | (() => Config)> | undefined>> {
  let ROOT: string = process.cwd()
  let userConfig: Config

  function initUserConfig() {
    if (typeof options === 'function') {
      userConfig = options()
    } else {
      userConfig = getConfig(options, ROOT)
    }
  }
  const isProduction = process.env.NODE_ENV === 'production'
  // Map from normalized route file path → set of shared binding names.
  // Populated by the reference compiler, consumed by virtual and shared compilers.
  const sharedBindingsMap = new Map<string, Set<string>>()

  const getGlobalCodeSplitGroupings = () => {
    return (
      userConfig.codeSplittingOptions?.defaultBehavior ||
      defaultCodeSplitGroupings
    )
  }
  const getShouldSplitFn = () => {
    return userConfig.codeSplittingOptions?.splitBehavior
  }

  const handleCompilingReferenceFile = (
    code: string,
    id: string,
    generatorNodeInfo: GetRoutesByFileMapResultValue,
  ): UnpluginTransformResult => {
    if (debug) console.info('Compiling Route: ', id)

    const fromCode = detectCodeSplitGroupingsFromRoute({
      code,
      filename: id,
    })

    if (fromCode.groupings !== undefined) {
      const res = splitGroupingsSchema.safeParse(fromCode.groupings)
      if (!res.success) {
        const message = res.error.issues.map((e) => e.message).join('. ')
        throw new Error(
          `The groupings for the route "${id}" are invalid.\n${message}`,
        )
      }
    }

    const userShouldSplitFn = getShouldSplitFn()

    const pluginSplitBehavior = userShouldSplitFn?.({
      routeId: generatorNodeInfo.routeId,
    }) as CodeSplitGroupings | undefined

    if (pluginSplitBehavior) {
      const res = splitGroupingsSchema.safeParse(pluginSplitBehavior)
      if (!res.success) {
        const message = res.error.issues.map((e) => e.message).join('. ')
        throw new Error(
          `The groupings returned when using \`splitBehavior\` for the route "${id}" are invalid.\n${message}`,
        )
      }
    }

    const splitGroupings: CodeSplitGroupings =
      fromCode.groupings ?? pluginSplitBehavior ?? getGlobalCodeSplitGroupings()

    // Compute shared bindings before compiling the reference route
    const sharedBindings = computeSharedBindings({
      code,
      filename: id,
      codeSplitGroupings: splitGroupings,
    })
    if (sharedBindings.size > 0) {
      sharedBindingsMap.set(id, sharedBindings)
    } else {
      sharedBindingsMap.delete(id)
    }

    const addHmr =
      (userConfig.codeSplittingOptions?.addHmr ?? true) && !isProduction
    const hmrStyle = userConfig.plugin?.hmr?.style ?? 'vite'

    const compiledReferenceRoute = compileCodeSplitReferenceRoute({
      code,
      codeSplitGroupings: splitGroupings,
      targetFramework: userConfig.target,
      filename: id,
      id,
      deleteNodes: userConfig.codeSplittingOptions?.deleteNodes
        ? new Set(userConfig.codeSplittingOptions.deleteNodes)
        : undefined,
      addHmr,
      hmrStyle,
      hmrRouteId: generatorNodeInfo.routeId,
      sharedBindings: sharedBindings.size > 0 ? sharedBindings : undefined,
      compilerPlugins: [
        ...(getReferenceRouteCompilerPlugins({
          targetFramework: userConfig.target,
          addHmr,
          hmrStyle,
        }) ?? []),
        ...(userConfig.codeSplittingOptions?.compilerPlugins ?? []),
      ],
    })

    if (compiledReferenceRoute === null) {
      if (debug) {
        console.info(
          `No changes made to route "${id}", skipping code-splitting.`,
        )
      }
      return null
    }
    if (debug) {
      logDiff(code, compiledReferenceRoute.code)
      console.log('Output:\n', compiledReferenceRoute.code + '\n\n')
    }

    return compiledReferenceRoute
  }

  const handleCompilingVirtualFile = (
    code: string,
    id: string,
  ): UnpluginTransformResult => {
    if (debug) console.info('Splitting Route: ', id)

    const [_, ...pathnameParts] = id.split('?')

    const searchParams = new URLSearchParams(pathnameParts.join('?'))
    const splitValue = searchParams.get(tsrSplit)

    if (!splitValue) {
      throw new Error(
        `The split value for the virtual route "${id}" was not found.`,
      )
    }

    const rawGrouping = decodeIdentifier(splitValue)
    const grouping = [...new Set(rawGrouping)].filter((p) =>
      splitRouteIdentNodes.includes(p as any),
    ) as Array<SplitRouteIdentNodes>

    const baseId = id.split('?')[0]!
    const resolvedSharedBindings = sharedBindingsMap.get(baseId)

    const result = compileCodeSplitVirtualRoute({
      code,
      filename: id,
      splitTargets: grouping,
      sharedBindings: resolvedSharedBindings,
    })

    if (debug) {
      logDiff(code, result.code)
      console.log('Output:\n', result.code + '\n\n')
    }

    return result
  }

  return [
    {
      name: 'tanstack-router:code-splitter:compile-reference-file',
      enforce: 'pre',

      transform: {
        filter: {
          id: {
            exclude: [tsrSplit, tsrShared],
            // this is necessary for webpack / rspack to avoid matching .html files
            include: /\.(m|c)?(j|t)sx?$/,
          },
          code: {
            include: routeFactoryCallCodeFilter,
          },
        },
        handler(code, id) {
          const normalizedId = normalizePath(id)
          const generatorFileInfo =
            routerPluginContext.routesByFile.get(normalizedId)
          if (generatorFileInfo) {
            return handleCompilingReferenceFile(
              code,
              normalizedId,
              generatorFileInfo,
            )
          }

          return null
        },
      },

      vite: {
        configResolved(config) {
          ROOT = config.root
          initUserConfig()

          // Validate plugin order - router must come before JSX transformation plugins
          const routerPluginIndex = config.plugins.findIndex(
            (p) => p.name === CODE_SPLITTER_PLUGIN_NAME,
          )

          if (routerPluginIndex === -1) return

          const frameworkPlugins =
            TRANSFORMATION_PLUGINS_BY_FRAMEWORK[userConfig.target]
          if (!frameworkPlugins) return

          for (const transformPlugin of frameworkPlugins) {
            const transformPluginIndex = config.plugins.findIndex((p) =>
              transformPlugin.pluginNames.includes(p.name),
            )

            if (
              transformPluginIndex !== -1 &&
              transformPluginIndex < routerPluginIndex
            ) {
              throw new Error(
                `Plugin order error: '${transformPlugin.pkg}' is placed before '@tanstack/router-plugin'.\n\n` +
                  `The TanStack Router plugin must come BEFORE JSX transformation plugins.\n\n` +
                  `Please update your Vite config:\n\n` +
                  `  plugins: [\n` +
                  `    tanstackRouter(),\n` +
                  `    ${transformPlugin.usage},\n` +
                  `  ]\n`,
              )
            }
          }
        },
        applyToEnvironment(environment) {
          if (userConfig.plugin?.vite?.environmentName) {
            return userConfig.plugin.vite.environmentName === environment.name
          }
          return true
        },
      },

      rspack() {
        ROOT = process.cwd()
        initUserConfig()
      },

      webpack() {
        ROOT = process.cwd()
        initUserConfig()
      },
    },
    {
      name: 'tanstack-router:code-splitter:compile-virtual-file',
      enforce: 'pre',

      transform: {
        filter: {
          id: /tsr-split/,
        },
        handler(code, id) {
          const url = pathToFileURL(id)
          url.searchParams.delete('v')
          const normalizedId = normalizePath(fileURLToPath(url))
          return handleCompilingVirtualFile(code, normalizedId)
        },
      },

      vite: {
        applyToEnvironment(environment) {
          if (userConfig.plugin?.vite?.environmentName) {
            return userConfig.plugin.vite.environmentName === environment.name
          }
          return true
        },
      },
    },
    {
      name: 'tanstack-router:code-splitter:compile-shared-file',
      enforce: 'pre',

      transform: {
        filter: {
          id: /tsr-shared/,
        },
        handler(code, id) {
          const url = pathToFileURL(id)
          url.searchParams.delete('v')
          const normalizedId = normalizePath(fileURLToPath(url))
          const [baseId] = normalizedId.split('?')

          if (!baseId) return null

          const sharedBindings = sharedBindingsMap.get(baseId)
          if (!sharedBindings || sharedBindings.size === 0) return null

          if (debug) console.info('Compiling Shared Module: ', id)

          const result = compileCodeSplitSharedRoute({
            code,
            sharedBindings,
            filename: normalizedId,
          })

          if (debug) {
            logDiff(code, result.code)
            console.log('Output:\n', result.code + '\n\n')
          }

          return result
        },
      },

      vite: {
        applyToEnvironment(environment) {
          if (userConfig.plugin?.vite?.environmentName) {
            return userConfig.plugin.vite.environmentName === environment.name
          }
          return true
        },
      },
    },
  ]
}

export const unpluginRouterCodeSplitterFactory: UnpluginFactory<
  Partial<Config | (() => Config)> | undefined
> = (options = {}) => {
  return createRouterCodeSplitterPlugin(options, createRouterPluginContext())
}
