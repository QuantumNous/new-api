const path = require('path')
const { resolveEntry, fileToComponentName } = require('./resolveWcEntry')

module.exports = (api, { target, entry, name, 'inline-vue': inlineVue }) => {
  // Disable CSS extraction and turn on CSS shadow mode for vue-style-loader
  process.env.VUE_CLI_CSS_SHADOW_MODE = true

  const { log, error } = require('@vue/cli-shared-utils')
  const abort = msg => {
    log()
    error(msg)
    process.exit(1)
  }

  const cwd = api.getCwd()
  const webpack = require('webpack')
  const vueMajor = require('../../util/getVueMajor')(cwd)
  if (vueMajor === 3) {
    abort(`Vue 3 support of the web component target is still under development.`)
  }

  const isAsync = /async/.test(target)

  // generate dynamic entry based on glob files
  const resolvedFiles = require('globby').sync(entry.split(','), { cwd: api.resolve('.') })

  if (!resolvedFiles.length) {
    abort(`entry pattern "${entry}" did not match any files.`)
  }
  let libName
  let prefix
  if (resolvedFiles.length === 1) {
    // in single mode, determine the lib name from filename
    libName = name || fileToComponentName('', resolvedFiles[0]).kebabName
    prefix = ''
    if (libName.indexOf('-') < 0) {
      abort(`--name must contain a hyphen when building a single web component.`)
    }
  } else {
    // multi mode
    libName = prefix = (name || api.service.pkg.name)
    if (!libName) {
      abort(`--name is required when building multiple web components.`)
    }
  }

  const dynamicEntry = resolveEntry(prefix, libName, resolvedFiles, isAsync)

  function genConfig (minify, genHTML) {
    const config = api.resolveChainableWebpackConfig()

    // make sure not to transpile wc-wrapper
    config.module
      .rule('js')
        .exclude
          .add(/vue-wc-wrapper/)

    // only minify min entry
    if (!minify) {
      config.optimization.minimize(false)
    }

    config
      .plugin('webpack-virtual-modules')
        .use(require('webpack-virtual-modules'), [{
          [dynamicEntry.filePath]: dynamicEntry.content
        }])

    config
      .plugin('web-component-options')
        .use(webpack.DefinePlugin, [{
          'process.env.CUSTOM_ELEMENT_NAME': JSON.stringify(libName)
        }])

    // enable shadow mode in vue-loader
    config.module
      .rule('vue')
        .use('vue-loader')
          .tap(options => {
            options.shadowMode = true
            return options
          })

    if (genHTML) {
      config
        .plugin('demo-html')
          .use(require('html-webpack-plugin'), [{
            template: path.resolve(__dirname, `./demo-wc.html`),
            inject: false,
            filename: 'demo.html',
            libName,
            vueMajor,
            components:
              prefix === ''
                ? [libName]
                : resolvedFiles.map(file => {
                  return fileToComponentName(prefix, file).kebabName
                })
          }])
    }

    // set entry/output last so it takes higher priority than user
    // configureWebpack hooks

    // set proxy entry for *.vue files
    config.resolve
      .alias
        .set('~root', api.resolve('.'))

    const rawConfig = api.resolveWebpackConfig(config)

    // externalize Vue in case user imports it
    rawConfig.externals = [
      ...(Array.isArray(rawConfig.externals) ? rawConfig.externals : [rawConfig.externals]),
      { ...(inlineVue || { vue: 'Vue' }) }
    ].filter(Boolean)

    const entryName = `${libName}${minify ? `.min` : ``}`
    rawConfig.entry = {
      [entryName]: dynamicEntry.filePath
    }

    Object.assign(rawConfig.output, {
      filename: `${entryName}.js`,
      chunkFilename: `${libName}.[name]${minify ? `.min` : ``}.js`,
      // use dynamic publicPath so this can be deployed anywhere
      // the actual path will be determined at runtime by checking
      // document.currentScript.src.
      publicPath: ''
    })

    // to ensure that multiple copies of async wc bundles can co-exist
    // on the same page.
    rawConfig.output.uniqueName = `vue-lib-${libName}`

    return rawConfig
  }

  return [
    genConfig(false, true),
    genConfig(true, false)
  ]
}
