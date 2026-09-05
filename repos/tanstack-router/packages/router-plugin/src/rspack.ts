import { createRspackPlugin } from 'unplugin'

import { configSchema } from './core/config'
import { createRouterCodeSplitterPlugin } from './core/router-code-splitter-plugin'
import { createRouterGeneratorPlugin } from './core/router-generator-plugin'
import { unpluginRouterComposedFactory } from './core/router-composed-plugin'
import { createRouterPluginContext } from './core/router-plugin-context'
import type { CodeSplittingOptions, Config } from './core/config'
import type { RouterPluginContext } from './core/router-plugin-context'

type RspackRouterPluginOptions = Partial<Config> | (() => Partial<Config>)

const defaultRouterPluginContext = createRouterPluginContext()

/**
 * Rspack uses webpack-compatible `module.hot` / `import.meta.webpackHot` HMR.
 * Force `plugin.hmr.style = 'webpack'` so the router HMR adapter emits
 * `module.hot`-style accept/dispose code instead of Vite's callback-receive
 * variant, regardless of what the user passes (or doesn't pass).
 */
function withWebpackHmrStyle(
  options: RspackRouterPluginOptions | undefined,
): RspackRouterPluginOptions {
  const mergeHmrStyle = (
    config: Partial<Config> | undefined,
  ): Partial<Config> => ({
    ...config,
    plugin: {
      ...config?.plugin,
      hmr: {
        ...config?.plugin?.hmr,
        style: 'webpack',
      },
    },
  })

  if (typeof options === 'function') {
    return () => mergeHmrStyle(options())
  }

  return mergeHmrStyle(options)
}

/**
 * @example
 * ```ts
 * export default defineConfig({
 *   // ...
 *   tools: {
 *     rspack: {
 *       plugins: [TanStackRouterGeneratorRspack()],
 *     },
 *   },
 * })
 * ```
 */
const TanStackRouterGeneratorRspack = (
  options?: RspackRouterPluginOptions,
  routerPluginContext?: RouterPluginContext,
) => {
  const pluginContext = routerPluginContext ?? defaultRouterPluginContext
  return createRspackPlugin((pluginOptions) =>
    createRouterGeneratorPlugin(
      pluginOptions as Partial<Config | (() => Config)> | undefined,
      pluginContext,
    ),
  )(options)
}

/**
 * @example
 * ```ts
 * export default defineConfig({
 *   // ...
 *   tools: {
 *     rspack: {
 *       plugins: [TanStackRouterCodeSplitterRspack()],
 *     },
 *   },
 * })
 * ```
 */
const TanStackRouterCodeSplitterRspack = (
  options?: RspackRouterPluginOptions,
  routerPluginContext?: RouterPluginContext,
) => {
  const pluginContext = routerPluginContext ?? defaultRouterPluginContext
  return createRspackPlugin((pluginOptions) =>
    createRouterCodeSplitterPlugin(
      withWebpackHmrStyle(
        pluginOptions as RspackRouterPluginOptions | undefined,
      ) as Partial<Config | (() => Config)>,
      pluginContext,
    ),
  )(options)
}

/**
 * @example
 * ```ts
 * export default defineConfig({
 *   // ...
 *   tools: {
 *     rspack: {
 *       plugins: [tanstackRouter()],
 *     },
 *   },
 * })
 * ```
 */
const TanStackRouterRspack = /* #__PURE__ */ createRspackPlugin(
  (options, meta) =>
    unpluginRouterComposedFactory(
      withWebpackHmrStyle(
        options as RspackRouterPluginOptions | undefined,
      ) as Partial<Config | (() => Config)>,
      meta,
    ),
)
const tanstackRouter = TanStackRouterRspack
export default TanStackRouterRspack
export {
  configSchema,
  TanStackRouterRspack,
  TanStackRouterGeneratorRspack,
  TanStackRouterCodeSplitterRspack,
  tanstackRouter,
}
export type { Config, CodeSplittingOptions, RouterPluginContext }
