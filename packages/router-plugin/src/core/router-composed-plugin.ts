import { getConfig } from '@tanstack/router-generator'
import { createRouterGeneratorPlugin } from './router-generator-plugin'
import { createRouterCodeSplitterPlugin } from './router-code-splitter-plugin'
import { createRouterHmrPlugin } from './router-hmr-plugin'
import { createRouterPluginContext } from './router-plugin-context'
import type { Config } from './config'
import type {
  RspackCompiler,
  UnpluginFactory,
  UnpluginOptions,
  WebpackCompiler,
} from 'unplugin'

const INLINE_CSS_DEFAULT_DEFINES = {
  'process.env.TSS_INLINE_CSS_ENABLED': JSON.stringify('false'),
  'import.meta.env.TSS_INLINE_CSS_ENABLED': JSON.stringify('false'),
}

type EsbuildOptionsWithDefine = Parameters<
  NonNullable<NonNullable<UnpluginOptions['esbuild']>['config']>
>[0]

function applyWebpackInlineCssDefaultDefinePlugin(compiler: WebpackCompiler) {
  new compiler.webpack.DefinePlugin(INLINE_CSS_DEFAULT_DEFINES).apply(compiler)
}

function applyRspackInlineCssDefaultDefinePlugin(compiler: RspackCompiler) {
  new compiler.webpack.DefinePlugin(INLINE_CSS_DEFAULT_DEFINES).apply(compiler)
}

export const unpluginRouterComposedFactory: UnpluginFactory<
  Partial<Config | (() => Config)> | undefined
> = (options = {}, _meta) => {
  const ROOT: string = process.cwd()
  const userConfig = getConfig(
    (typeof options === 'function' ? options() : options) as Partial<Config>,
    ROOT,
  )
  const routerPluginContext = createRouterPluginContext()

  const getPlugin = (plugin: ReturnType<UnpluginFactory<any>>) => {
    if (!Array.isArray(plugin)) {
      return [plugin]
    }
    return plugin
  }

  const routerGenerator = getPlugin(
    createRouterGeneratorPlugin(options, routerPluginContext),
  )
  const routerCodeSplitter = getPlugin(
    createRouterCodeSplitterPlugin(options, routerPluginContext),
  )

  const result = [
    {
      name: 'tanstack:router-inline-css-defaults',
      vite: {
        config() {
          return {
            define: {
              ...INLINE_CSS_DEFAULT_DEFINES,
            },
          }
        },
      },
      webpack(compiler: WebpackCompiler) {
        applyWebpackInlineCssDefaultDefinePlugin(compiler)
      },
      rspack(compiler: RspackCompiler) {
        applyRspackInlineCssDefaultDefinePlugin(compiler)
      },
      esbuild: {
        config(options: EsbuildOptionsWithDefine) {
          options.define = {
            ...INLINE_CSS_DEFAULT_DEFINES,
            ...options.define,
          }
        },
      },
    },
    ...routerGenerator,
  ]
  if (userConfig.autoCodeSplitting) {
    result.push(...routerCodeSplitter)
  }

  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction && !userConfig.autoCodeSplitting) {
    const routerHmr = getPlugin(
      createRouterHmrPlugin(options, routerPluginContext),
    )
    result.push(...routerHmr)
  }
  return result
}
