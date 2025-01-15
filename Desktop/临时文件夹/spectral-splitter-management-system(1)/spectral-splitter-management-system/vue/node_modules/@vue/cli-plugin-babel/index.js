const path = require('path')
const babel = require('@babel/core')
const { isWindows } = require('@vue/cli-shared-utils')

function getDepPathRegex (dependencies) {
  const deps = dependencies.map(dep => {
    if (typeof dep === 'string') {
      const depPath = path.join('node_modules', dep, '/')
      return isWindows
        ? depPath.replace(/\\/g, '\\\\') // double escape for windows style path
        : depPath
    } else if (dep instanceof RegExp) {
      return dep.source
    }

    throw new Error('transpileDependencies only accepts an array of string or regular expressions')
  })
  return deps.length ? new RegExp(deps.join('|')) : null
}

/** @type {import('@vue/cli-service').ServicePlugin} */
module.exports = (api, options) => {
  const useThreads = process.env.NODE_ENV === 'production' && !!options.parallel
  const cliServicePath = path.dirname(require.resolve('@vue/cli-service'))

  // try to load the project babel config;
  // if the default preset is used,
  // there will be a VUE_CLI_TRANSPILE_BABEL_RUNTIME env var set.
  // the `filename` field is required
  // in case there're filename-related options like `ignore` in the user config
  babel.loadPartialConfigSync({ filename: api.resolve('src/main.js') })

  api.chainWebpack(webpackConfig => {
    webpackConfig.resolveLoader.modules.prepend(path.join(__dirname, 'node_modules'))

    const jsRule = webpackConfig.module
      .rule('js')
        .test(/\.m?jsx?$/)
        .exclude
          .add(filepath => {
            const SHOULD_SKIP = true
            const SHOULD_TRANSPILE = false

            // With data URI support in webpack 5, filepath could be undefined
            if (!filepath) {
              return SHOULD_SKIP
            }

            // Always transpile js in vue files
            if (/\.vue\.jsx?$/.test(filepath)) {
              return SHOULD_TRANSPILE
            }
            // Exclude dynamic entries from cli-service
            if (filepath.startsWith(cliServicePath)) {
              return SHOULD_SKIP
            }

            // To transpile `@babel/runtime`, the config needs to be
            // carefully adjusted to avoid infinite loops.
            // So we only do the tranpilation when the special flag is on.
            if (getDepPathRegex(['@babel/runtime']).test(filepath)) {
              return process.env.VUE_CLI_TRANSPILE_BABEL_RUNTIME
                ? SHOULD_TRANSPILE
                : SHOULD_SKIP
            }

            // if `transpileDependencies` is set to true, transpile all deps
            if (options.transpileDependencies === true) {
              // Some of the deps cannot be transpiled, though
              // https://stackoverflow.com/a/58517865/2302258
              const NON_TRANSPILABLE_DEPS = [
                'core-js',
                'webpack',
                'webpack-4',
                'css-loader',
                'mini-css-extract-plugin',
                'promise-polyfill',
                'html-webpack-plugin',
                'whatwg-fetch'
              ]
              const nonTranspilableDepsRegex = getDepPathRegex(NON_TRANSPILABLE_DEPS)
              return nonTranspilableDepsRegex.test(filepath) ? SHOULD_SKIP : SHOULD_TRANSPILE
            }

            // Otherwise, check if this is something the user explicitly wants to transpile
            if (Array.isArray(options.transpileDependencies)) {
              const transpileDepRegex = getDepPathRegex(options.transpileDependencies)
              if (transpileDepRegex && transpileDepRegex.test(filepath)) {
                return SHOULD_TRANSPILE
              }
            }

            // Don't transpile node_modules
            return /node_modules/.test(filepath) ? SHOULD_SKIP : SHOULD_TRANSPILE
          })
          .end()

    if (useThreads) {
      const threadLoaderConfig = jsRule
        .use('thread-loader')
          .loader(require.resolve('thread-loader'))

      if (typeof options.parallel === 'number') {
        threadLoaderConfig.options({ workers: options.parallel })
      }
    }

    jsRule
      .use('babel-loader')
        .loader(require.resolve('babel-loader'))
        .options({
          cacheCompression: false,
          ...api.genCacheConfig('babel-loader', {
            '@babel/core': require('@babel/core/package.json').version,
            '@vue/babel-preset-app': require('@vue/babel-preset-app/package.json').version,
            'babel-loader': require('babel-loader/package.json').version,
            modern: !!process.env.VUE_CLI_MODERN_BUILD,
            browserslist: api.service.pkg.browserslist
          }, [
            'babel.config.js',
            '.browserslistrc'
          ])
        })
  })
}
