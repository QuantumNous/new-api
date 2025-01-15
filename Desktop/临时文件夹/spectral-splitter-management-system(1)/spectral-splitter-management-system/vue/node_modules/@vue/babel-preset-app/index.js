const path = require('path')
const semver = require('semver')

const defaultPolyfills = [
  // promise polyfill alone doesn't work in IE,
  // needs this as well. see: #1642
  'es.array.iterator',
  // this is required for webpack code splitting, vuex etc.
  'es.promise',
  // this is needed for object rest spread support in templates
  // as vue-template-es2015-compiler 1.8+ compiles it to Object.assign() calls.
  'es.object.assign',
  // #2012 es.promise replaces native Promise in FF and causes missing finally
  'es.promise.finally'
]

const {
  default: getTargets,
  isRequired
} = require('@babel/helper-compilation-targets')

// We'll no longer need this logic in Babel 8 as it's the default behavior
// See discussions at:
// https://github.com/babel/rfcs/pull/2#issuecomment-714785228
// https://github.com/babel/babel/pull/12189
function getIntersectionTargets (targets, constraintTargets) {
  const intersection = Object.keys(constraintTargets).reduce(
    (results, browser) => {
      // exclude the browsers that the user does not need
      if (!targets[browser]) {
        return results
      }

      // if the user-specified version is higher the minimum version that supports esmodule, than use it
      results[browser] = semver.gt(
        semver.coerce(constraintTargets[browser]),
        semver.coerce(targets[browser])
      )
        ? constraintTargets[browser]
        : targets[browser]

      return results
    },
    {}
  )

  return intersection
}

function getModuleTargets (targets) {
  const allModuleTargets = getTargets(
    { esmodules: true },
    { ignoreBrowserslistConfig: true }
  )

  // use the intersection of modern mode browsers and user defined targets config
  return getIntersectionTargets(targets, allModuleTargets)
}

function getWCTargets (targets) {
  // targeting browsers that at least support ES2015 classes
  // https://github.com/babel/babel/blob/v7.9.6/packages/babel-compat-data/data/plugins.json#L194-L204
  const allWCTargets = getTargets(
    {
      browsers: [
        'Chrome >= 46',
        'Firefox >= 45',
        'Safari >= 10',
        'Edge >= 13',
        'iOS >= 10',
        'Electron >= 0.36'
      ]
    },
    { ignoreBrowserslistConfig: true }
  )

  // use the intersection of browsers supporting Web Components and user defined targets config
  return getIntersectionTargets(targets, allWCTargets)
}

function getPolyfills (targets, includes) {
  // if no targets specified, include all default polyfills
  if (!targets || !Object.keys(targets).length) {
    return includes
  }

  const compatData = require('core-js-compat').data
  return includes.filter(item => {
    if (!compatData[item]) {
      throw new Error(`Cannot find polyfill ${item}, please refer to 'core-js-compat' for a complete list of available modules`)
    }

    return isRequired(item, targets, { compatData })
  })
}

module.exports = (context, options = {}) => {
  const presets = []
  const plugins = []
  const defaultEntryFiles = JSON.parse(process.env.VUE_CLI_ENTRY_FILES || '[]')

  // Though in the vue-cli repo, we only use the two environment variables
  // for tests, users may have relied on them for some features,
  // dropping them may break some projects.
  // So in the following blocks we don't directly test the `NODE_ENV`.
  // Rather, we turn it into the two commonly used feature flags.
  if (!process.env.VUE_CLI_TEST && process.env.NODE_ENV === 'test') {
    // Both Jest & Mocha set NODE_ENV to 'test'.
    // And both requires the `node` target.
    process.env.VUE_CLI_BABEL_TARGET_NODE = 'true'
    // Jest runs without bundling so it needs this.
    // With the node target, tree shaking is not a necessity,
    // so we set it for maximum compatibility.
    process.env.VUE_CLI_BABEL_TRANSPILE_MODULES = 'true'
  }

  // JSX
  if (options.jsx !== false) {
    let jsxOptions = {}
    if (typeof options.jsx === 'object') {
      jsxOptions = options.jsx
    }

    let vueVersion = 2
    try {
      const Vue = require('vue')
      vueVersion = semver.major(Vue.version)
    } catch (e) {}

    if (vueVersion === 2) {
      presets.push([require('@vue/babel-preset-jsx'), jsxOptions])
    } else if (vueVersion === 3) {
      plugins.push([require('@vue/babel-plugin-jsx'), jsxOptions])
    }
  }

  const runtimePath = path.dirname(require.resolve('@babel/runtime/package.json'))
  const runtimeVersion = require('@babel/runtime/package.json').version
  const {
    polyfills: userPolyfills,
    loose = false,
    debug = false,
    useBuiltIns = 'usage',
    modules = false,
    bugfixes = true,
    targets: rawTargets,
    spec,
    ignoreBrowserslistConfig,
    configPath,
    include,
    exclude,
    shippedProposals,
    forceAllTransforms,
    decoratorsBeforeExport,
    decoratorsLegacy,
    // entry file list
    entryFiles = defaultEntryFiles,

    // Undocumented option of @babel/plugin-transform-runtime.
    // When enabled, an absolute path is used when importing a runtime helper after transforming.
    // This ensures the transpiled file always use the runtime version required in this package.
    // However, this may cause hash inconsistency if the project is moved to another directory.
    // So here we allow user to explicit disable this option if hash consistency is a requirement
    // and the runtime version is sure to be correct.
    absoluteRuntime = runtimePath,

    // https://babeljs.io/docs/en/babel-plugin-transform-runtime#version
    // By default transform-runtime assumes that @babel/runtime@7.0.0-beta.0 is installed, which means helpers introduced later than 7.0.0-beta.0 will be inlined instead of imported.
    // See https://github.com/babel/babel/issues/10261
    // And https://github.com/facebook/docusaurus/pull/2111
    version = runtimeVersion
  } = options

  // resolve targets for preset-env
  let targets = getTargets(rawTargets, { ignoreBrowserslistConfig, configPath })
  if (process.env.VUE_CLI_BABEL_TARGET_NODE) {
    // running tests in Node.js
    targets = { node: 'current' }
  } else if (process.env.VUE_CLI_BUILD_TARGET === 'wc' || process.env.VUE_CLI_BUILD_TARGET === 'wc-async') {
    // targeting browsers that at least support ES2015 classes
    targets = getWCTargets(targets)
  } else if (process.env.VUE_CLI_MODERN_BUILD) {
    // targeting browsers that at least support <script type="module">
    targets = getModuleTargets(targets)
  }

  // included-by-default polyfills. These are common polyfills that 3rd party
  // dependencies may rely on (e.g. Vuex relies on Promise), but since with
  // useBuiltIns: 'usage' we won't be running Babel on these deps, they need to
  // be force-included.
  let polyfills
  const buildTarget = process.env.VUE_CLI_BUILD_TARGET || 'app'
  if (
    buildTarget === 'app' &&
    useBuiltIns === 'usage' &&
    !process.env.VUE_CLI_BABEL_TARGET_NODE
  ) {
    polyfills = getPolyfills(targets, userPolyfills || defaultPolyfills)
    plugins.push([
      require('./polyfillsPlugin'),
      { polyfills, entryFiles, useAbsolutePath: !!absoluteRuntime }
    ])
  } else {
    polyfills = []
  }

  const envOptions = {
    bugfixes,
    corejs: useBuiltIns ? require('core-js/package.json').version : false,
    spec,
    loose,
    debug,
    modules,
    targets,
    useBuiltIns,
    ignoreBrowserslistConfig,
    configPath,
    include,
    exclude: polyfills.concat(exclude || []),
    shippedProposals,
    forceAllTransforms
  }

  // cli-plugin-jest sets this to true because Jest runs without bundling
  if (process.env.VUE_CLI_BABEL_TRANSPILE_MODULES) {
    envOptions.modules = 'commonjs'
    if (process.env.VUE_CLI_BABEL_TARGET_NODE) {
      // necessary for dynamic import to work in tests
      plugins.push(require('babel-plugin-dynamic-import-node'))
    }
  }

  // pass options along to babel-preset-env
  presets.unshift([require('@babel/preset-env'), envOptions])

  // additional <= stage-3 plugins
  // Babel 7 is removing stage presets altogether because people are using
  // too many unstable proposals. Let's be conservative in the defaults here.
  plugins.push(
    require('@babel/plugin-syntax-dynamic-import'),
    [require('@babel/plugin-proposal-decorators'), {
      decoratorsBeforeExport,
      legacy: decoratorsLegacy !== false
    }],
    [require('@babel/plugin-proposal-class-properties'), { loose }]
  )

  // transform runtime, but only for helpers
  plugins.push([require('@babel/plugin-transform-runtime'), {
    regenerator: useBuiltIns !== 'usage',

    // polyfills are injected by preset-env & polyfillsPlugin, so no need to add them again
    corejs: false,

    helpers: useBuiltIns === 'usage',
    useESModules: !process.env.VUE_CLI_BABEL_TRANSPILE_MODULES,

    absoluteRuntime,

    version
  }])

  return {
    sourceType: 'unambiguous',
    overrides: [{
      exclude: [/@babel[/|\\\\]runtime/, /core-js/],
      presets,
      plugins
    }, {
      // there are some untranspiled code in @babel/runtime
      // https://github.com/babel/babel/issues/9903
      include: [/@babel[/|\\\\]runtime/],
      presets: [
        [require('@babel/preset-env'), envOptions]
      ]
    }]
  }
}

// a special flag to tell @vue/cli-plugin-babel to include @babel/runtime for transpilation
// otherwise the above `include` option won't take effect
process.env.VUE_CLI_TRANSPILE_BABEL_RUNTIME = true
