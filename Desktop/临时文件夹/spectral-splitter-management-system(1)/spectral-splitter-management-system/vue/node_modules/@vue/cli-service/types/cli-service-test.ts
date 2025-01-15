import { ServicePlugin } from '@vue/cli-service'

const servicePlugin: ServicePlugin = (api, options) => {
  const version = api.version
  api.assertVersion(4)
  api.assertVersion('^100')
  api.getCwd()
  api.resolve('src/main.js')
  api.hasPlugin('eslint')
  api.registerCommand(
    'lint',
    {
      description: 'lint and fix source files',
      usage: 'vue-cli-service lint [options] [...files]',
      options: {
        '--format [formatter]': 'specify formatter (default: stylish)'
      },
      details: 'For more options, see https://eslint.org/docs/user-guide/command-line-interface#options'
    },
    async args => {
      await require('./lint')(args, api)
    }
  )
  api.registerCommand('lint', args => {})

  api.chainWebpack(webpackConfig => {
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      webpackConfig.devtool('eval-cheap-module-source-map')

      webpackConfig.plugin('hmr').use(require('webpack/lib/HotModuleReplacementPlugin'))

      webpackConfig.output.globalObject(`(typeof self !== 'undefined' ? self : this)`)
    }
  })

  api.configureWebpack(config => {
    config.output = {
      path: 'test-dist-2'
    }
  })

  api.configureWebpack(config => {
    return {
      devtool: config.devtool || 'source-map'
    }
  })

  api.resolveWebpackConfig()

  api.resolveWebpackConfig(api.resolveChainableWebpackConfig())

  const { cacheIdentifier, cacheDirectory } = api.genCacheConfig(
    'babel-loader',
    {
      '@babel/core': require('@babel/core/package.json').version,
      '@vue/babel-preset-app': require('@vue/babel-preset-app/package.json').version,
      'babel-loader': require('babel-loader/package.json').version,
      modern: !!process.env.VUE_CLI_MODERN_BUILD,
      browserslist: api.service.pkg.browserslist
    },
    ['babel.config.js', '.browserslistrc']
  )
}
export = servicePlugin
