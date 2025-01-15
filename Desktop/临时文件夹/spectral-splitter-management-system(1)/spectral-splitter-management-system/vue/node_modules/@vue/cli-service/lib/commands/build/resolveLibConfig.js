const fs = require('fs')
const path = require('path')

module.exports = (api, { entry, name, formats, filename, 'inline-vue': inlineVue }, options) => {
  const { log, error } = require('@vue/cli-shared-utils')
  const abort = msg => {
    log()
    error(msg)
    process.exit(1)
  }

  const vueMajor = require('../../util/getVueMajor')(api.getCwd())

  const fullEntryPath = api.resolve(entry)

  if (!fs.existsSync(fullEntryPath)) {
    abort(
      `Failed to resolve lib entry: ${entry}${entry === `src/App.vue` ? ' (default)' : ''}. ` +
      `Make sure to specify the correct entry file.`
    )
  }

  const isVueEntry = /\.vue$/.test(entry)
  const libName = (
    name ||
    (
      api.service.pkg.name
        ? api.service.pkg.name.replace(/^@.+\//, '')
        : path.basename(entry).replace(/\.(jsx?|vue)$/, '')
    )
  )
  filename = filename || libName
  function genConfig (format, postfix = format, genHTML) {
    const config = api.resolveChainableWebpackConfig()

    const browserslist = require('browserslist')
    const targets = browserslist(undefined, { path: fullEntryPath })
    const supportsIE = targets.some(agent => agent.includes('ie'))

    const webpack = require('webpack')
    config.plugin('need-current-script-polyfill')
      .use(webpack.DefinePlugin, [{
        'process.env.NEED_CURRENTSCRIPT_POLYFILL': JSON.stringify(supportsIE)
      }])

    // adjust css output name so they write to the same file
    if (config.plugins.has('extract-css')) {
      config
        .plugin('extract-css')
          .tap(args => {
            args[0].filename = `${filename}.css`
            return args
          })
    }

    // only minify min entry
    if (!/\.min/.test(postfix)) {
      config.optimization.minimize(false)
    }

    // inject demo page for umd
    if (genHTML) {
      const template = isVueEntry ? 'demo-lib.html' : 'demo-lib-js.html'
      config
        .plugin('demo-html')
          .use(require('html-webpack-plugin'), [{
            template: path.resolve(__dirname, template),
            inject: false,
            filename: 'demo.html',
            libName,
            vueMajor,
            assetsFileName: filename,
            cssExtract: config.plugins.has('extract-css')
          }])
    }

    // resolve entry/output
    const entryName = `${filename}.${postfix}`
    config.resolve
      .alias
        .set('~entry', fullEntryPath)

    // set output target before user configureWebpack hooks are applied
    config.output.libraryTarget(format)

    // set entry/output after user configureWebpack hooks are applied
    const rawConfig = api.resolveWebpackConfig(config)

    let realEntry = require.resolve('./entry-lib.js')

    // avoid importing default if user entry file does not have default export
    if (!isVueEntry) {
      const entryContent = fs.readFileSync(fullEntryPath, 'utf-8')
      if (!/\b(export\s+default|export\s{[^}]+as\s+default)\b/.test(entryContent)) {
        realEntry = require.resolve('./entry-lib-no-default.js')
      }
    }

    // externalize Vue in case user imports it
    rawConfig.externals = [
      ...(Array.isArray(rawConfig.externals) ? rawConfig.externals : [rawConfig.externals]),
      {
        ...(inlineVue || {
          vue: {
            commonjs: 'vue',
            commonjs2: 'vue',
            root: 'Vue'
          }
        })
      }
    ].filter(Boolean)

    rawConfig.entry = {
      [entryName]: realEntry
    }

    rawConfig.output = Object.assign({
      library: libName,
      libraryExport: isVueEntry ? 'default' : undefined,
      libraryTarget: format,
      // preserve UDM header from webpack 3 until webpack provides either
      // libraryTarget: 'esm' or target: 'universal'
      // https://github.com/webpack/webpack/issues/6522
      // https://github.com/webpack/webpack/issues/6525
      globalObject: `(typeof self !== 'undefined' ? self : this)`
    }, rawConfig.output, {
      filename: `${entryName}.js`,
      chunkFilename: `${entryName}.[name].js`,
      // use dynamic publicPath so this can be deployed anywhere
      // the actual path will be determined at runtime by checking
      // document.currentScript.src.
      publicPath: ''
    })

    if (format === 'commonjs2') {
      // #6188
      delete rawConfig.output.library
    }

    return rawConfig
  }

  const configMap = {
    commonjs: genConfig('commonjs2', 'common'),
    umd: genConfig('umd', undefined, true),
    'umd-min': genConfig('umd', 'umd.min')
  }

  const formatArray = (formats + '').split(',')
  const configs = formatArray.map(format => configMap[format])
  if (configs.indexOf(undefined) !== -1) {
    const unknownFormats = formatArray.filter(f => configMap[f] === undefined).join(', ')
    abort(
      `Unknown library build formats: ${unknownFormats}`
    )
  }

  return configs
}
