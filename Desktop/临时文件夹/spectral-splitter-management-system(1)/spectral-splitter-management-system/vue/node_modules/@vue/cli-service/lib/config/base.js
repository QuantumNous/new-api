const path = require('path')

/** @type {import('@vue/cli-service').ServicePlugin} */
module.exports = (api, options) => {
  const cwd = api.getCwd()
  const webpack = require('webpack')
  const vueMajor = require('../util/getVueMajor')(cwd)

  api.chainWebpack(webpackConfig => {
    const isLegacyBundle = process.env.VUE_CLI_MODERN_MODE && !process.env.VUE_CLI_MODERN_BUILD
    const resolveLocal = require('../util/resolveLocal')

    // https://github.com/webpack/webpack/issues/14532#issuecomment-947525539
    webpackConfig.output.set('hashFunction', 'xxhash64')

    // https://github.com/webpack/webpack/issues/11467#issuecomment-691873586
    webpackConfig.module
      .rule('esm')
        .test(/\.m?jsx?$/)
        .resolve.set('fullySpecified', false)

    webpackConfig
      .mode('development')
      .context(api.service.context)
      .entry('app')
        .add('./src/main.js')
        .end()
      .output
        .path(api.resolve(options.outputDir))
        .filename(isLegacyBundle ? '[name]-legacy.js' : '[name].js')
        .publicPath(options.publicPath)

    webpackConfig.resolve
      .extensions
        .merge(['.mjs', '.js', '.jsx', '.vue', '.json', '.wasm'])
        .end()
      .modules
        .add('node_modules')
        .add(api.resolve('node_modules'))
        .add(resolveLocal('node_modules'))
        .end()
      .alias
        .set('@', api.resolve('src'))

    webpackConfig.resolveLoader
      .modules
        .add('node_modules')
        .add(api.resolve('node_modules'))
        .add(resolveLocal('node_modules'))

    webpackConfig.module
      .noParse(/^(vue|vue-router|vuex|vuex-router-sync)$/)

    // js is handled by cli-plugin-babel ---------------------------------------

    // vue-loader --------------------------------------------------------------
    let cacheLoaderPath
    try {
      cacheLoaderPath = require.resolve('cache-loader')
    } catch (e) {}

    if (vueMajor === 2) {
      // for Vue 2 projects
      const partialIdentifier = {
        'vue-loader': require('@vue/vue-loader-v15/package.json').version,
        '@vue/component-compiler-utils': require('@vue/component-compiler-utils/package.json').version
      }

      try {
        partialIdentifier['vue-template-compiler'] = require('vue-template-compiler/package.json').version
      } catch (e) {
        // For Vue 2.7 projects, `vue-template-compiler` is not required
      }

      const vueLoaderCacheConfig = api.genCacheConfig('vue-loader', partialIdentifier)

      webpackConfig.resolve
        .alias
          .set(
            'vue$',
            options.runtimeCompiler
              ? 'vue/dist/vue.esm.js'
              : 'vue/dist/vue.runtime.esm.js'
          )

      if (cacheLoaderPath) {
        webpackConfig.module
          .rule('vue')
            .test(/\.vue$/)
            .use('cache-loader')
              .loader(cacheLoaderPath)
              .options(vueLoaderCacheConfig)
      }

      webpackConfig.module
        .rule('vue')
          .test(/\.vue$/)
          .use('vue-loader')
            .loader(require.resolve('@vue/vue-loader-v15'))
            .options(Object.assign({
              compilerOptions: {
                whitespace: 'condense'
              }
            }, cacheLoaderPath ? vueLoaderCacheConfig : {}))

      webpackConfig
        .plugin('vue-loader')
          .use(require('@vue/vue-loader-v15').VueLoaderPlugin)

      // some plugins may implicitly relies on the `vue-loader` dependency path name
      // such as vue-cli-plugin-apollo
      // <https://github.com/Akryum/vue-cli-plugin-apollo/blob/d9fe48c61cc19db88fef4e4aa5e49b31aa0c44b7/index.js#L88>
      // so we need a hotfix for that
      webpackConfig
        .resolveLoader
          .modules
            .prepend(path.resolve(__dirname, './vue-loader-v15-resolve-compat'))
    } else if (vueMajor === 3) {
      // for Vue 3 projects
      const vueLoaderCacheConfig = api.genCacheConfig('vue-loader', {
        'vue-loader': require('vue-loader/package.json').version
      })

      webpackConfig.resolve
        .alias
          .set(
            'vue$',
            options.runtimeCompiler
              ? 'vue/dist/vue.esm-bundler.js'
              : 'vue/dist/vue.runtime.esm-bundler.js'
          )

      if (cacheLoaderPath) {
        webpackConfig.module
          .rule('vue')
            .test(/\.vue$/)
            .use('cache-loader')
              .loader(cacheLoaderPath)
              .options(vueLoaderCacheConfig)
      }

      webpackConfig.module
        .rule('vue')
          .test(/\.vue$/)
          .use('vue-loader')
            .loader(require.resolve('vue-loader'))
            .options({
              ...vueLoaderCacheConfig,
              babelParserPlugins: ['jsx', 'classProperties', 'decorators-legacy']
            })

      webpackConfig
        .plugin('vue-loader')
          .use(require('vue-loader').VueLoaderPlugin)

      // feature flags <http://link.vuejs.org/feature-flags>
      webpackConfig
        .plugin('feature-flags')
          .use(webpack.DefinePlugin, [{
            __VUE_OPTIONS_API__: 'true',
            __VUE_PROD_DEVTOOLS__: 'false'
          }])
    }

    // https://github.com/vuejs/vue-loader/issues/1435#issuecomment-869074949
    webpackConfig.module
      .rule('vue-style')
        .test(/\.vue$/)
          .resourceQuery(/type=style/)
            .sideEffects(true)

    // Other common pre-processors ---------------------------------------------
    const maybeResolve = name => {
      try {
        return require.resolve(name)
      } catch (error) {
        return name
      }
    }

    webpackConfig.module
      .rule('pug')
        .test(/\.pug$/)
          .oneOf('pug-vue')
            .resourceQuery(/vue/)
            .use('pug-plain-loader')
              .loader(maybeResolve('pug-plain-loader'))
              .end()
            .end()
          .oneOf('pug-template')
            .use('raw')
              .loader(maybeResolve('raw-loader'))
              .end()
            .use('pug-plain-loader')
              .loader(maybeResolve('pug-plain-loader'))
              .end()
            .end()

    const resolveClientEnv = require('../util/resolveClientEnv')
    webpackConfig
      .plugin('define')
        .use(webpack.DefinePlugin, [
          resolveClientEnv(options)
        ])

    webpackConfig
      .plugin('case-sensitive-paths')
        .use(require('case-sensitive-paths-webpack-plugin'))

    // friendly error plugin displays very confusing errors when webpack
    // fails to resolve a loader, so we provide custom handlers to improve it
    const { transformer, formatter } = require('../util/resolveLoaderError')
    webpackConfig
      .plugin('friendly-errors')
        .use(require('@soda/friendly-errors-webpack-plugin'), [{
          additionalTransformers: [transformer],
          additionalFormatters: [formatter]
        }])

    const TerserPlugin = require('terser-webpack-plugin')
    const terserOptions = require('./terserOptions')
    webpackConfig.optimization
      .minimizer('terser')
        .use(TerserPlugin, [terserOptions(options)])
  })
}
