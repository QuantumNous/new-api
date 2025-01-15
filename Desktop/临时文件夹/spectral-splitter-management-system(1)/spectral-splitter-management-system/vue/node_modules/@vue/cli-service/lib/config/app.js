// config that are specific to --target app
const fs = require('fs')
const path = require('path')

// ensure the filename passed to html-webpack-plugin is a relative path
// because it cannot correctly handle absolute paths
function ensureRelative (outputDir, _path) {
  if (path.isAbsolute(_path)) {
    return path.relative(outputDir, _path)
  } else {
    return _path
  }
}

module.exports = (api, options) => {
  api.chainWebpack(webpackConfig => {
    // only apply when there's no alternative target
    if (process.env.VUE_CLI_BUILD_TARGET && process.env.VUE_CLI_BUILD_TARGET !== 'app') {
      return
    }

    const isProd = process.env.NODE_ENV === 'production'
    const isLegacyBundle = process.env.VUE_CLI_MODERN_MODE && !process.env.VUE_CLI_MODERN_BUILD
    const outputDir = api.resolve(options.outputDir)

    const getAssetPath = require('../util/getAssetPath')
    const outputFilename = getAssetPath(
      options,
      `js/[name]${isLegacyBundle ? `-legacy` : ``}${isProd && options.filenameHashing ? '.[contenthash:8]' : ''}.js`
    )
    webpackConfig
      .output
        .filename(outputFilename)
        .chunkFilename(outputFilename)

    // FIXME: a temporary workaround to get accurate contenthash in `applyLegacy`
    // Should use a better fix per discussions at <https://github.com/jantimon/html-webpack-plugin/issues/1554#issuecomment-753653580>
    webpackConfig.optimization
      .set('realContentHash', false)

    // code splitting
    if (process.env.NODE_ENV !== 'test') {
      webpackConfig.optimization.splitChunks({
        cacheGroups: {
          defaultVendors: {
            name: `chunk-vendors`,
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            chunks: 'initial'
          },
          common: {
            name: `chunk-common`,
            minChunks: 2,
            priority: -20,
            chunks: 'initial',
            reuseExistingChunk: true
          }
        }
      })
    }

    // HTML plugin
    const resolveClientEnv = require('../util/resolveClientEnv')

    const htmlOptions = {
      title: api.service.pkg.name,
      scriptLoading: 'defer',
      templateParameters: (compilation, assets, assetTags, pluginOptions) => {
        // enhance html-webpack-plugin's built in template params
        return Object.assign({
          compilation: compilation,
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            tags: assetTags,
            files: assets,
            options: pluginOptions
          }
        }, resolveClientEnv(options, true /* raw */))
      }
    }

    // handle indexPath
    if (options.indexPath !== 'index.html') {
      // why not set filename for html-webpack-plugin?
      // 1. It cannot handle absolute paths
      // 2. Relative paths causes incorrect SW manifest to be generated (#2007)
      webpackConfig
        .plugin('move-index')
        .use(require('../webpack/MovePlugin'), [
          path.resolve(outputDir, 'index.html'),
          path.resolve(outputDir, options.indexPath)
        ])
    }

    // resolve HTML file(s)
    const HTMLPlugin = require('html-webpack-plugin')
    // const PreloadPlugin = require('@vue/preload-webpack-plugin')
    const multiPageConfig = options.pages
    const htmlPath = api.resolve('public/index.html')
    const defaultHtmlPath = path.resolve(__dirname, 'index-default.html')
    const publicCopyIgnore = ['**/.DS_Store']

    if (!multiPageConfig) {
      // default, single page setup.
      htmlOptions.template = fs.existsSync(htmlPath)
        ? htmlPath
        : defaultHtmlPath

      publicCopyIgnore.push(api.resolve(htmlOptions.template).replace(/\\/g, '/'))

      webpackConfig
        .plugin('html')
          .use(HTMLPlugin, [htmlOptions])

      // FIXME: need to test out preload plugin's compatibility with html-webpack-plugin 4/5
      // if (!isLegacyBundle) {
      //   // inject preload/prefetch to HTML
      //   webpackConfig
      //     .plugin('preload')
      //       .use(PreloadPlugin, [{
      //         rel: 'preload',
      //         include: 'initial',
      //         fileBlacklist: [/\.map$/, /hot-update\.js$/]
      //       }])

      //   webpackConfig
      //     .plugin('prefetch')
      //       .use(PreloadPlugin, [{
      //         rel: 'prefetch',
      //         include: 'asyncChunks'
      //       }])
      // }
    } else {
      // multi-page setup
      webpackConfig.entryPoints.clear()

      const pages = Object.keys(multiPageConfig)
      const normalizePageConfig = c => typeof c === 'string' ? { entry: c } : c

      pages.forEach(name => {
        const pageConfig = normalizePageConfig(multiPageConfig[name])
        const {
          entry,
          template = `public/${name}.html`,
          filename = `${name}.html`,
          chunks = ['chunk-vendors', 'chunk-common', name]
        } = pageConfig

        // Currently Cypress v3.1.0 comes with a very old version of Node,
        // which does not support object rest syntax.
        // (https://github.com/cypress-io/cypress/issues/2253)
        // So here we have to extract the customHtmlOptions manually.
        const customHtmlOptions = {}
        for (const key in pageConfig) {
          if (
            !['entry', 'template', 'filename', 'chunks'].includes(key)
          ) {
            customHtmlOptions[key] = pageConfig[key]
          }
        }

        // inject entry
        const entries = Array.isArray(entry) ? entry : [entry]
        webpackConfig.entry(name).merge(entries.map(e => api.resolve(e)))

        // trim inline loader
        // * See https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md#2-setting-a-loader-directly-for-the-template
        const templateWithoutLoader = template.replace(/^.+!/, '').replace(/\?.+$/, '')

        // resolve page index template
        const hasDedicatedTemplate = fs.existsSync(api.resolve(templateWithoutLoader))
        const templatePath = hasDedicatedTemplate
          ? template
          : fs.existsSync(htmlPath)
            ? htmlPath
            : defaultHtmlPath

        publicCopyIgnore.push(api.resolve(templateWithoutLoader).replace(/\\/g, '/'))

        // inject html plugin for the page
        const pageHtmlOptions = Object.assign(
          {},
          htmlOptions,
          {
            chunks,
            template: templatePath,
            filename: ensureRelative(outputDir, filename)
          },
          customHtmlOptions
        )

        webpackConfig
          .plugin(`html-${name}`)
            .use(HTMLPlugin, [pageHtmlOptions])
      })

      // FIXME: preload plugin is not compatible with webpack 5 / html-webpack-plugin 4 yet
      // if (!isLegacyBundle) {
      //   pages.forEach(name => {
      //     const filename = ensureRelative(
      //       outputDir,
      //       normalizePageConfig(multiPageConfig[name]).filename || `${name}.html`
      //     )
      //     webpackConfig
      //       .plugin(`preload-${name}`)
      //         .use(PreloadPlugin, [{
      //           rel: 'preload',
      //           includeHtmlNames: [filename],
      //           include: {
      //             type: 'initial',
      //             entries: [name]
      //           },
      //           fileBlacklist: [/\.map$/, /hot-update\.js$/]
      //         }])

      //     webpackConfig
      //       .plugin(`prefetch-${name}`)
      //         .use(PreloadPlugin, [{
      //           rel: 'prefetch',
      //           includeHtmlNames: [filename],
      //           include: {
      //             type: 'asyncChunks',
      //             entries: [name]
      //           }
      //         }])
      //   })
      // }
    }

    // CORS and Subresource Integrity
    if (options.crossorigin != null || options.integrity) {
      webpackConfig
        .plugin('cors')
          .use(require('../webpack/CorsPlugin'), [{
            crossorigin: options.crossorigin,
            integrity: options.integrity,
            publicPath: options.publicPath
          }])
    }

    // copy static assets in public/
    const publicDir = api.resolve('public')
    const CopyWebpackPlugin = require('copy-webpack-plugin')
    const PlaceholderPlugin = class PlaceholderPlugin { apply () {} }

    const copyOptions = {
      patterns: [{
        from: publicDir,
        to: outputDir,
        toType: 'dir',
        noErrorOnMissing: true,
        globOptions: {
          ignore: publicCopyIgnore
        },
        info: {
          minimized: true
        }
      }]
    }

    if (fs.existsSync(publicDir)) {
      if (isLegacyBundle) {
        webpackConfig.plugin('copy').use(PlaceholderPlugin, [copyOptions])
      } else {
        webpackConfig.plugin('copy').use(CopyWebpackPlugin, [copyOptions])
      }
    }
  })
}
