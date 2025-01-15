// @ts-check
const TerserPlugin = require('terser-webpack-plugin')

const genTerserOptions = (defaultOptions, options) => {
  const userOptions = options.terser && options.terser.terserOptions
  // user's config is first
  return {
    ...defaultOptions,
    ...userOptions
  }
}

const terserMinify = (options) => ({
  terserOptions: genTerserOptions(
    {
      compress: {
        // turn off flags with small gains to speed up minification
        arrows: false,
        collapse_vars: false, // 0.3kb
        comparisons: false,
        computed_props: false,
        hoist_funs: false,
        hoist_props: false,
        hoist_vars: false,
        inline: false,
        loops: false,
        negate_iife: false,
        properties: false,
        reduce_funcs: false,
        reduce_vars: false,
        switches: false,
        toplevel: false,
        typeofs: false,

        // a few flags with noticeable gains/speed ratio
        // numbers based on out of the box vendor bundle
        booleans: true, // 0.7kb
        if_return: true, // 0.4kb
        sequences: true, // 0.7kb
        unused: true, // 2.3kb

        // required features to drop conditional branches
        conditionals: true,
        dead_code: true,
        evaluate: true
      },
      mangle: {
        safari10: true
      }
    },
    options
  ),
  parallel: options.parallel,
  extractComments: false
})

// `terserOptions` options will be passed to `esbuild`
// Link to options - https://esbuild.github.io/api/#minify
const esbuildMinify = (options) => ({
  minify: TerserPlugin.esbuildMinify,
  terserOptions: genTerserOptions(
    {
      minify: false,
      minifyWhitespace: true,
      minifyIdentifiers: false,
      minifySyntax: true
    },
    options
  ),
  parallel: options.parallel
})

// `terserOptions` options will be passed to `swc` (`@swc/core`)
// Link to options - https://swc.rs/docs/config-js-minify
const swcMinify = (options) => ({
  minify: TerserPlugin.swcMinify,
  terserOptions: genTerserOptions(
    {
      compress: {
        unused: true
      },
      mangle: true
    },
    options
  ),
  parallel: options.parallel
})

// `terserOptions` options will be passed to `uglify-js`
// Link to options - https://github.com/mishoo/UglifyJS#minify-options
const uglifyJsMinify = (options) => ({
  minify: TerserPlugin.uglifyJsMinify,
  terserOptions: genTerserOptions({}, options),
  parallel: options.parallel
})

// Currently we do not allow custom minify function
const getMinify = (options) => {
  const { minify = 'terser' } = options.terser || {}

  const minifyMap = {
    terser: terserMinify,
    esbuild: esbuildMinify,
    swc: swcMinify,
    uglifyJs: uglifyJsMinify
  }
  return minifyMap[minify](options)
}

module.exports = getMinify
