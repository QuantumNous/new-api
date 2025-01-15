const { createSchema, validate } = require('@vue/cli-shared-utils')

const schema = createSchema(joi => joi.object({
  publicPath: joi.string().allow(''),
  outputDir: joi.string(),
  assetsDir: joi.string().allow(''),
  indexPath: joi.string(),
  filenameHashing: joi.boolean(),
  runtimeCompiler: joi.boolean(),
  transpileDependencies: joi.alternatives().try(
    joi.boolean(),
    joi.array()
  ),
  productionSourceMap: joi.boolean(),
  parallel: joi.alternatives().try(
    joi.boolean(),
    joi.number().integer()
  ),
  devServer: joi.object(),
  pages: joi.object().pattern(
    /\w+/,
    joi.alternatives().try(
      joi.string().required(),
      joi.array().items(joi.string().required()),

      joi.object().keys({
        entry: joi.alternatives().try(
          joi.string().required(),
          joi.array().items(joi.string().required())
        ).required()
      }).unknown(true)
    )
  ),
  crossorigin: joi.string().valid('', 'anonymous', 'use-credentials'),
  integrity: joi.boolean(),

  // css
  css: joi.object({
    extract: joi.alternatives().try(joi.boolean(), joi.object()),
    sourceMap: joi.boolean(),
    loaderOptions: joi.object({
      css: joi.object(),
      sass: joi.object(),
      scss: joi.object(),
      less: joi.object(),
      stylus: joi.object(),
      postcss: joi.object()
    })
  }),

  // webpack
  chainWebpack: joi.func(),
  configureWebpack: joi.alternatives().try(
    joi.object(),
    joi.func()
  ),

  // known runtime options for built-in plugins
  lintOnSave: joi.any().valid(true, false, 'error', 'warning', 'default'),
  pwa: joi.object(),

  // terser
  terser: joi.object({
    minify: joi.string().valid('terser', 'esbuild', 'swc', 'uglifyJs'),
    terserOptions: joi.object()
  }),

  // 3rd party plugin options
  pluginOptions: joi.object()
}))

exports.validate = (options, cb) => {
  validate(options, schema, cb)
}

// #2110
// https://github.com/nodejs/node/issues/19022
// in some cases cpus() returns undefined, and may simply throw in the future
function hasMultipleCores () {
  try {
    return require('os').cpus().length > 1
  } catch (e) {
    return false
  }
}

exports.defaults = () => ({
  // project deployment base
  publicPath: '/',

  // where to output built files
  outputDir: 'dist',

  // where to put static assets (js/css/img/font/...)
  assetsDir: '',

  // filename for index.html (relative to outputDir)
  indexPath: 'index.html',

  // whether filename will contain hash part
  filenameHashing: true,

  // boolean, use full build?
  runtimeCompiler: false,

  // whether to transpile all dependencies
  transpileDependencies: false,

  // sourceMap for production build?
  productionSourceMap: !process.env.VUE_CLI_TEST,

  // use thread-loader for babel & TS in production build
  // enabled by default if the machine has more than 1 cores
  parallel: hasMultipleCores(),

  // multi-page config
  pages: undefined,

  // <script type="module" crossorigin="use-credentials">
  // #1656, #1867, #2025
  crossorigin: undefined,

  // subresource integrity
  integrity: false,

  css: {
    // extract: true,
    // modules: false,
    // sourceMap: false,
    // loaderOptions: {}
  },

  // whether to use eslint-loader
  lintOnSave: 'default',

  devServer: {
    /*
    open: process.platform === 'darwin',
    host: '0.0.0.0',
    port: 8080,
    https: false,
    hotOnly: false,
    proxy: null, // string | Object
    before: app => {}
  */
  }
})
