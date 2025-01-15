const path = require('path')
const debug = require('debug')
const { merge } = require('webpack-merge')
const Config = require('webpack-chain')
const PluginAPI = require('./PluginAPI')
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')
const defaultsDeep = require('lodash.defaultsdeep')
const { warn, error, isPlugin, resolvePluginId, loadModule, resolvePkg, resolveModule, sortPlugins } = require('@vue/cli-shared-utils')

const { defaults } = require('./options')
const loadFileConfig = require('./util/loadFileConfig')
const resolveUserConfig = require('./util/resolveUserConfig')

// Seems we can't use `instanceof Promise` here (would fail the tests)
const isPromise = p => p && typeof p.then === 'function'
module.exports = class Service {
  constructor (context, { plugins, pkg, inlineOptions, useBuiltIn } = {}) {
    process.VUE_CLI_SERVICE = this
    this.initialized = false
    this.context = context
    this.inlineOptions = inlineOptions
    this.webpackChainFns = []
    this.webpackRawConfigFns = []
    this.devServerConfigFns = []
    this.commands = {}
    // Folder containing the target package.json for plugins
    this.pkgContext = context
    // package.json containing the plugins
    this.pkg = this.resolvePkg(pkg)
    // If there are inline plugins, they will be used instead of those
    // found in package.json.
    // When useBuiltIn === false, built-in plugins are disabled. This is mostly
    // for testing.
    this.plugins = this.resolvePlugins(plugins, useBuiltIn)
    // pluginsToSkip will be populated during run()
    this.pluginsToSkip = new Set()
    // resolve the default mode to use for each command
    // this is provided by plugins as module.exports.defaultModes
    // so we can get the information without actually applying the plugin.
    this.modes = this.plugins.reduce((modes, { apply: { defaultModes } }) => {
      return Object.assign(modes, defaultModes)
    }, {})
  }

  resolvePkg (inlinePkg, context = this.context) {
    if (inlinePkg) {
      return inlinePkg
    }
    const pkg = resolvePkg(context)
    if (pkg.vuePlugins && pkg.vuePlugins.resolveFrom) {
      this.pkgContext = path.resolve(context, pkg.vuePlugins.resolveFrom)
      return this.resolvePkg(null, this.pkgContext)
    }
    return pkg
  }

  init (mode = process.env.VUE_CLI_MODE) {
    if (this.initialized) {
      return
    }
    this.initialized = true
    this.mode = mode

    // load mode .env
    if (mode) {
      this.loadEnv(mode)
    }
    // load base .env
    this.loadEnv()

    // load user config
    const userOptions = this.loadUserOptions()
    const loadedCallback = (loadedUserOptions) => {
      this.projectOptions = defaultsDeep(loadedUserOptions, defaults())

      debug('vue:project-config')(this.projectOptions)

      // apply plugins.
      this.plugins.forEach(({ id, apply }) => {
        if (this.pluginsToSkip.has(id)) return
        apply(new PluginAPI(id, this), this.projectOptions)
      })

      // apply webpack configs from project config file
      if (this.projectOptions.chainWebpack) {
        this.webpackChainFns.push(this.projectOptions.chainWebpack)
      }
      if (this.projectOptions.configureWebpack) {
        this.webpackRawConfigFns.push(this.projectOptions.configureWebpack)
      }
    }

    if (isPromise(userOptions)) {
      return userOptions.then(loadedCallback)
    } else {
      return loadedCallback(userOptions)
    }
  }

  loadEnv (mode) {
    const logger = debug('vue:env')
    const basePath = path.resolve(this.context, `.env${mode ? `.${mode}` : ``}`)
    const localPath = `${basePath}.local`

    const load = envPath => {
      try {
        const env = dotenv.config({ path: envPath, debug: process.env.DEBUG })
        dotenvExpand(env)
        logger(envPath, env)
      } catch (err) {
        // only ignore error if file is not found
        if (err.toString().indexOf('ENOENT') < 0) {
          error(err)
        }
      }
    }

    load(localPath)
    load(basePath)

    // by default, NODE_ENV and BABEL_ENV are set to "development" unless mode
    // is production or test. However the value in .env files will take higher
    // priority.
    if (mode) {
      // always set NODE_ENV during tests
      // as that is necessary for tests to not be affected by each other
      const shouldForceDefaultEnv = (
        process.env.VUE_CLI_TEST &&
        !process.env.VUE_CLI_TEST_TESTING_ENV
      )
      const defaultNodeEnv = (mode === 'production' || mode === 'test')
        ? mode
        : 'development'
      if (shouldForceDefaultEnv || process.env.NODE_ENV == null) {
        process.env.NODE_ENV = defaultNodeEnv
      }
      if (shouldForceDefaultEnv || process.env.BABEL_ENV == null) {
        process.env.BABEL_ENV = defaultNodeEnv
      }
    }
  }

  setPluginsToSkip (args, rawArgv) {
    let skipPlugins = args['skip-plugins']
    const pluginsToSkip = new Set()
    if (skipPlugins) {
      // When only one appearence, convert to array to prevent duplicate code
      if (!Array.isArray(skipPlugins)) {
        skipPlugins = Array.from([skipPlugins])
      }
      // Iter over all --skip-plugins appearences
      for (const value of skipPlugins.values()) {
        for (const plugin of value.split(',').map(id => resolvePluginId(id))) {
          pluginsToSkip.add(plugin)
        }
      }
    }
    this.pluginsToSkip = pluginsToSkip

    delete args['skip-plugins']
    // Delete all --skip-plugin appearences
    let index
    while ((index = rawArgv.indexOf('--skip-plugins')) > -1) {
      rawArgv.splice(index, 2) // Remove the argument and its value
    }
  }

  resolvePlugins (inlinePlugins, useBuiltIn) {
    const idToPlugin = (id, absolutePath) => ({
      id: id.replace(/^.\//, 'built-in:'),
      apply: require(absolutePath || id)
    })

    let plugins

    const builtInPlugins = [
      './commands/serve',
      './commands/build',
      './commands/inspect',
      './commands/help',
      // config plugins are order sensitive
      './config/base',
      './config/assets',
      './config/css',
      './config/prod',
      './config/app'
    ].map((id) => idToPlugin(id))

    if (inlinePlugins) {
      plugins = useBuiltIn !== false
        ? builtInPlugins.concat(inlinePlugins)
        : inlinePlugins
    } else {
      const projectPlugins = Object.keys(this.pkg.devDependencies || {})
        .concat(Object.keys(this.pkg.dependencies || {}))
        .filter(isPlugin)
        .map(id => {
          if (
            this.pkg.optionalDependencies &&
            id in this.pkg.optionalDependencies
          ) {
            let apply = loadModule(id, this.pkgContext)
            if (!apply) {
              warn(`Optional dependency ${id} is not installed.`)
              apply = () => {}
            }

            return { id, apply }
          } else {
            return idToPlugin(id, resolveModule(id, this.pkgContext))
          }
        })

      plugins = builtInPlugins.concat(projectPlugins)
    }

    // Local plugins
    if (this.pkg.vuePlugins && this.pkg.vuePlugins.service) {
      const files = this.pkg.vuePlugins.service
      if (!Array.isArray(files)) {
        throw new Error(`Invalid type for option 'vuePlugins.service', expected 'array' but got ${typeof files}.`)
      }
      plugins = plugins.concat(files.map(file => ({
        id: `local:${file}`,
        apply: loadModule(`./${file}`, this.pkgContext)
      })))
    }
    debug('vue:plugins')(plugins)

    const orderedPlugins = sortPlugins(plugins)
    debug('vue:plugins-ordered')(orderedPlugins)

    return orderedPlugins
  }

  async run (name, args = {}, rawArgv = []) {
    // resolve mode
    // prioritize inline --mode
    // fallback to resolved default modes from plugins or development if --watch is defined
    const mode = args.mode || (name === 'build' && args.watch ? 'development' : this.modes[name])

    // --skip-plugins arg may have plugins that should be skipped during init()
    this.setPluginsToSkip(args, rawArgv)

    // load env variables, load user config, apply plugins
    await this.init(mode)

    args._ = args._ || []
    let command = this.commands[name]
    if (!command && name) {
      error(`command "${name}" does not exist.`)
      process.exit(1)
    }
    if (!command || args.help || args.h) {
      command = this.commands.help
    } else {
      args._.shift() // remove command itself
      rawArgv.shift()
    }
    const { fn } = command
    return fn(args, rawArgv)
  }

  resolveChainableWebpackConfig () {
    const chainableConfig = new Config()
    // apply chains
    this.webpackChainFns.forEach(fn => fn(chainableConfig))
    return chainableConfig
  }

  resolveWebpackConfig (chainableConfig = this.resolveChainableWebpackConfig()) {
    if (!this.initialized) {
      throw new Error('Service must call init() before calling resolveWebpackConfig().')
    }
    // get raw config
    let config = chainableConfig.toConfig()
    const original = config
    // apply raw config fns
    this.webpackRawConfigFns.forEach(fn => {
      if (typeof fn === 'function') {
        // function with optional return value
        const res = fn(config)
        if (res) config = merge(config, res)
      } else if (fn) {
        // merge literal values
        config = merge(config, fn)
      }
    })

    // #2206 If config is merged by merge-webpack, it discards the __ruleNames
    // information injected by webpack-chain. Restore the info so that
    // vue inspect works properly.
    if (config !== original) {
      cloneRuleNames(
        config.module && config.module.rules,
        original.module && original.module.rules
      )
    }

    // check if the user has manually mutated output.publicPath
    const target = process.env.VUE_CLI_BUILD_TARGET
    if (
      !process.env.VUE_CLI_TEST &&
      (target && target !== 'app') &&
      config.output.publicPath !== this.projectOptions.publicPath
    ) {
      throw new Error(
        `Do not modify webpack output.publicPath directly. ` +
        `Use the "publicPath" option in vue.config.js instead.`
      )
    }

    if (
      !process.env.VUE_CLI_ENTRY_FILES &&
      typeof config.entry !== 'function'
    ) {
      let entryFiles
      if (typeof config.entry === 'string') {
        entryFiles = [config.entry]
      } else if (Array.isArray(config.entry)) {
        entryFiles = config.entry
      } else {
        entryFiles = Object.values(config.entry || []).reduce((allEntries, curr) => {
          return allEntries.concat(curr)
        }, [])
      }

      entryFiles = entryFiles.map(file => path.resolve(this.context, file))
      process.env.VUE_CLI_ENTRY_FILES = JSON.stringify(entryFiles)
    }

    return config
  }

  // Note: we intentionally make this function synchronous by default
  // because eslint-import-resolver-webpack does not support async webpack configs.
  loadUserOptions () {
    const { fileConfig, fileConfigPath } = loadFileConfig(this.context)

    if (isPromise(fileConfig)) {
      return fileConfig
        .then(mod => mod.default)
        .then(loadedConfig => resolveUserConfig({
          inlineOptions: this.inlineOptions,
          pkgConfig: this.pkg.vue,
          fileConfig: loadedConfig,
          fileConfigPath
        }))
    }

    return resolveUserConfig({
      inlineOptions: this.inlineOptions,
      pkgConfig: this.pkg.vue,
      fileConfig,
      fileConfigPath
    })
  }
}

function cloneRuleNames (to, from) {
  if (!to || !from) {
    return
  }
  from.forEach((r, i) => {
    if (to[i]) {
      Object.defineProperty(to[i], '__ruleNames', {
        value: r.__ruleNames
      })
      cloneRuleNames(to[i].oneOf, r.oneOf)
    }
  })
}

/** @type {import('../types/index').defineConfig} */
module.exports.defineConfig = (config) => config
