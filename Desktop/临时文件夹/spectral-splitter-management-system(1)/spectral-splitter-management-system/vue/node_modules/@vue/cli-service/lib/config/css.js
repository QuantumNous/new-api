const fs = require('fs')
const path = require('path')
const { chalk, semver, loadModule } = require('@vue/cli-shared-utils')
const isAbsoluteUrl = require('../util/isAbsoluteUrl')

const findExisting = (context, files) => {
  for (const file of files) {
    if (fs.existsSync(path.join(context, file))) {
      return file
    }
  }
}

module.exports = (api, rootOptions) => {
  api.chainWebpack(webpackConfig => {
    const getAssetPath = require('../util/getAssetPath')
    const shadowMode = !!process.env.VUE_CLI_CSS_SHADOW_MODE
    const isProd = process.env.NODE_ENV === 'production'

    const {
      extract = isProd,
      sourceMap = false,
      loaderOptions = {}
    } = rootOptions.css || {}

    const shouldExtract = extract !== false && !shadowMode
    const filename = getAssetPath(
      rootOptions,
      `css/[name]${rootOptions.filenameHashing ? '.[contenthash:8]' : ''}.css`
    )
    const extractOptions = Object.assign({
      filename,
      chunkFilename: filename
    }, extract && typeof extract === 'object' ? extract : {})

    // when project publicPath is a relative path
    // use relative publicPath in extracted CSS based on extract location
    const cssPublicPath = (isAbsoluteUrl(rootOptions.publicPath) || rootOptions.publicPath.startsWith('/'))
      ? rootOptions.publicPath
      : process.env.VUE_CLI_BUILD_TARGET === 'lib'
        // in lib mode, CSS is extracted to dist root.
        ? './'
        : '../'.repeat(
          extractOptions.filename
            .replace(/^\.[/\\]/, '')
            .split(/[/\\]/g)
            .length - 1
        )

    // check if the project has a valid postcss config
    // if it doesn't, don't use postcss-loader for direct style imports
    // because otherwise it would throw error when attempting to load postcss config
    const hasPostCSSConfig = !!(loaderOptions.postcss || api.service.pkg.postcss || findExisting(api.resolve('.'), [
      '.postcssrc',
      '.postcssrc.js',
      'postcss.config.js',
      '.postcssrc.yaml',
      '.postcssrc.json'
    ]))

    if (!hasPostCSSConfig) {
      // #6342
      // NPM 6 may incorrectly hoist postcss 7 to the same level of autoprefixer
      // So we have to run a preflight check to tell the users how to fix it
      const autoprefixerDirectory = path.dirname(require.resolve('autoprefixer/package.json'))
      const postcssPkg = loadModule('postcss/package.json', autoprefixerDirectory)
      const postcssVersion = postcssPkg.version
      if (!semver.satisfies(postcssVersion, '8.x')) {
        throw new Error(
          `The package manager has hoisted a wrong version of ${chalk.cyan('postcss')}, ` +
          `please run ${chalk.cyan('npm i postcss@8 -D')} to fix it.`
        )
      }

      loaderOptions.postcss = {
        postcssOptions: {
          plugins: [
            require('autoprefixer')
          ]
        }
      }
    }

    // if building for production but not extracting CSS, we need to minimize
    // the embbeded inline CSS as they will not be going through the optimizing
    // plugin.
    const needInlineMinification = isProd && !shouldExtract

    const cssnanoOptions = {
      preset: ['default', {
        mergeLonghand: false,
        cssDeclarationSorter: false
      }]
    }
    if (rootOptions.productionSourceMap && sourceMap) {
      cssnanoOptions.map = { inline: false }
    }

    function createCSSRule (lang, test, loader, options) {
      const baseRule = webpackConfig.module.rule(lang).test(test)

      // rules for <style module>
      const vueModulesRule = baseRule.oneOf('vue-modules').resourceQuery(/module/)
      applyLoaders(vueModulesRule, true)

      // rules for <style>
      const vueNormalRule = baseRule.oneOf('vue').resourceQuery(/\?vue/)
      applyLoaders(vueNormalRule)

      // rules for *.module.* files
      const extModulesRule = baseRule.oneOf('normal-modules').test(/\.module\.\w+$/)
      applyLoaders(extModulesRule)

      // rules for normal CSS imports
      const normalRule = baseRule.oneOf('normal')
      applyLoaders(normalRule)

      function applyLoaders (rule, forceCssModule = false) {
        if (shouldExtract) {
          rule
            .use('extract-css-loader')
            .loader(require('mini-css-extract-plugin').loader)
            .options({
              publicPath: cssPublicPath
            })
        } else {
          rule
            .use('vue-style-loader')
            .loader(require.resolve('vue-style-loader'))
            .options({
              sourceMap,
              shadowMode
            })
        }

        const cssLoaderOptions = Object.assign({
          sourceMap,
          importLoaders: (
            1 + // stylePostLoader injected by vue-loader
            1 + // postcss-loader
            (needInlineMinification ? 1 : 0)
          )
        }, loaderOptions.css)

        if (forceCssModule) {
          cssLoaderOptions.modules = {
            ...cssLoaderOptions.modules,
            auto: () => true
          }
        }

        if (cssLoaderOptions.modules) {
          cssLoaderOptions.modules = {
            localIdentName: '[name]_[local]_[hash:base64:5]',
            ...cssLoaderOptions.modules
          }
        }

        rule
          .use('css-loader')
          .loader(require.resolve('css-loader'))
          .options(cssLoaderOptions)

        if (needInlineMinification) {
          rule
            .use('cssnano')
            .loader(require.resolve('postcss-loader'))
            .options({
              sourceMap,
              postcssOptions: {
                plugins: [require('cssnano')(cssnanoOptions)]
              }
            })
        }

        rule
          .use('postcss-loader')
          .loader(require.resolve('postcss-loader'))
          .options(Object.assign({ sourceMap }, loaderOptions.postcss))

        if (loader) {
          let resolvedLoader
          try {
            resolvedLoader = require.resolve(loader)
          } catch (error) {
            resolvedLoader = loader
          }

          rule
            .use(loader)
            .loader(resolvedLoader)
            .options(Object.assign({ sourceMap }, options))
        }
      }
    }

    createCSSRule('css', /\.css$/)
    createCSSRule('postcss', /\.p(ost)?css$/)
    createCSSRule('scss', /\.scss$/, 'sass-loader', Object.assign(
      {},
      loaderOptions.scss || loaderOptions.sass
    ))
    createCSSRule('sass', /\.sass$/, 'sass-loader', Object.assign(
      {},
      loaderOptions.sass,
      {
        sassOptions: Object.assign(
          {},
          loaderOptions.sass && loaderOptions.sass.sassOptions,
          {
            indentedSyntax: true
          }
        )
      }
    ))
    createCSSRule('less', /\.less$/, 'less-loader', loaderOptions.less)
    createCSSRule('stylus', /\.styl(us)?$/, 'stylus-loader', loaderOptions.stylus)

    // inject CSS extraction plugin
    if (shouldExtract) {
      webpackConfig
        .plugin('extract-css')
          .use(require('mini-css-extract-plugin'), [extractOptions])

      // minify extracted CSS
      webpackConfig.optimization
        .minimizer('css')
          .use(require('css-minimizer-webpack-plugin'), [{
            parallel: rootOptions.parallel,
            minimizerOptions: cssnanoOptions
          }])
    }
  })
}
