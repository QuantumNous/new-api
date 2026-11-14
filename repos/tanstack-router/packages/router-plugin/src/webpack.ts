import { createWebpackPlugin } from 'unplugin'

import { configSchema } from './core/config'
import { createRouterCodeSplitterPlugin } from './core/router-code-splitter-plugin'
import { createRouterGeneratorPlugin } from './core/router-generator-plugin'
import { unpluginRouterComposedFactory } from './core/router-composed-plugin'
import { createRouterPluginContext } from './core/router-plugin-context'
import type { CodeSplittingOptions, Config } from './core/config'
import type { RouterPluginContext } from './core/router-plugin-context'

const defaultRouterPluginContext = createRouterPluginContext()

/**
 * Webpack uses `module.hot` / `import.meta.webpackHot` HMR. Force
 * `plugin.hmr.style = 'webpack'` so the router HMR adapter emits the correct
 * accept/dispose shape regardless of user config.
 */
function withWebpackHmrStyle(
  options: Partial<Config> | undefined,
): Partial<Config> {
  return {
    ...options,
    plugin: {
      ...options?.plugin,
      hmr: {
        ...options?.plugin?.hmr,
        style: 'webpack',
      },
    },
  }
}

/**
 * @example
 * ```ts
 * export default {
 *   // ...
 *   plugins: [TanStackRouterGeneratorWebpack()],
 * }
 * ```
 */
const TanStackRouterGeneratorWebpack = (
  options?: Partial<Config>,
  routerPluginContext?: RouterPluginContext,
) => {
  const pluginContext = routerPluginContext ?? defaultRouterPluginContext
  return createWebpackPlugin((pluginOptions: Partial<Config> | undefined) =>
    createRouterGeneratorPlugin(pluginOptions, pluginContext),
  )(options)
}

/**
 * @example
 * ```ts
 * export default {
 *   // ...
 *   plugins: [TanStackRouterCodeSplitterWebpack()],
 * }
 * ```
 */
const TanStackRouterCodeSplitterWebpack = (
  options?: Partial<Config>,
  routerPluginContext?: RouterPluginContext,
) => {
  const pluginContext = routerPluginContext ?? defaultRouterPluginContext
  return createWebpackPlugin((pluginOptions: Partial<Config> | undefined) =>
    createRouterCodeSplitterPlugin(
      withWebpackHmrStyle(pluginOptions),
      pluginContext,
    ),
  )(options)
}

/**
 * @example
 * ```ts
 * export default {
 *   // ...
 *   plugins: [tanstackRouter()],
 * }
 * ```
 */
const TanStackRouterWebpack = /* #__PURE__ */ createWebpackPlugin(
  (options, meta) =>
    unpluginRouterComposedFactory(
      withWebpackHmrStyle(options as Partial<Config> | undefined),
      meta,
    ),
)

const tanstackRouter = TanStackRouterWebpack
export default TanStackRouterWebpack
export {
  configSchema,
  TanStackRouterWebpack,
  TanStackRouterGeneratorWebpack,
  TanStackRouterCodeSplitterWebpack,
  tanstackRouter,
}
export type { Config, CodeSplittingOptions, RouterPluginContext }
