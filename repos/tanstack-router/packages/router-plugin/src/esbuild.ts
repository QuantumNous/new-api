import { createEsbuildPlugin } from 'unplugin'

import { configSchema } from './core/config'
import { createRouterCodeSplitterPlugin } from './core/router-code-splitter-plugin'
import { createRouterGeneratorPlugin } from './core/router-generator-plugin'
import { unpluginRouterComposedFactory } from './core/router-composed-plugin'
import { createRouterPluginContext } from './core/router-plugin-context'

import type { CodeSplittingOptions, Config } from './core/config'
import type { RouterPluginContext } from './core/router-plugin-context'

type RouterPluginOptions = Partial<Config | (() => Config)> | undefined

const defaultRouterPluginContext = createRouterPluginContext()

/**
 * @example
 * ```ts
 * export default {
 *   plugins: [TanStackRouterGeneratorEsbuild()],
 *   // ...
 * }
 * ```
 */
const TanStackRouterGeneratorEsbuild = (
  options?: RouterPluginOptions,
  routerPluginContext?: RouterPluginContext,
) => {
  const pluginContext = routerPluginContext ?? defaultRouterPluginContext
  return createEsbuildPlugin((pluginOptions: RouterPluginOptions) =>
    createRouterGeneratorPlugin(pluginOptions, pluginContext),
  )(options)
}

/**
 * @example
 * ```ts
 * export default {
 *  plugins: [TanStackRouterCodeSplitterEsbuild()],
 *  // ...
 * }
 * ```
 */
const TanStackRouterCodeSplitterEsbuild = (
  options?: RouterPluginOptions,
  routerPluginContext?: RouterPluginContext,
) => {
  const pluginContext = routerPluginContext ?? defaultRouterPluginContext
  return createEsbuildPlugin((pluginOptions: RouterPluginOptions) =>
    createRouterCodeSplitterPlugin(pluginOptions, pluginContext),
  )(options)
}

/**
 * @example
 * ```ts
 * export default {
 *   plugins: [tanstackRouter()],
 *   // ...
 * }
 * ```
 */
const TanStackRouterEsbuild = createEsbuildPlugin(unpluginRouterComposedFactory)
const tanstackRouter = TanStackRouterEsbuild
export default TanStackRouterEsbuild

export {
  configSchema,
  TanStackRouterGeneratorEsbuild,
  TanStackRouterCodeSplitterEsbuild,
  TanStackRouterEsbuild,
  tanstackRouter,
}

export type { Config, CodeSplittingOptions, RouterPluginContext }
