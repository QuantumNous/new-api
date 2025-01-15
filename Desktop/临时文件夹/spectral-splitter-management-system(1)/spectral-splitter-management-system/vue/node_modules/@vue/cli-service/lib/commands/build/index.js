const defaults = {
  clean: true,
  target: 'app',
  module: true,
  formats: 'commonjs,umd,umd-min'
}

const buildModes = {
  lib: 'library',
  wc: 'web component',
  'wc-async': 'web component (async)'
}

const modifyConfig = (config, fn) => {
  if (Array.isArray(config)) {
    config.forEach(c => fn(c))
  } else {
    fn(config)
  }
}

module.exports = (api, options) => {
  api.registerCommand('build', {
    description: 'build for production',
    usage: 'vue-cli-service build [options] [entry|pattern]',
    options: {
      '--mode': `specify env mode (default: production)`,
      '--dest': `specify output directory (default: ${options.outputDir})`,
      '--no-module': `build app without generating <script type="module"> chunks for modern browsers`,
      '--target': `app | lib | wc | wc-async (default: ${defaults.target})`,
      '--inline-vue': 'include the Vue module in the final bundle of library or web component target',
      '--formats': `list of output formats for library builds (default: ${defaults.formats})`,
      '--name': `name for lib or web-component mode (default: "name" in package.json or entry filename)`,
      '--filename': `file name for output, only usable for 'lib' target (default: value of --name)`,
      '--no-clean': `do not remove the dist directory contents before building the project`,
      '--report': `generate report.html to help analyze bundle content`,
      '--report-json': 'generate report.json to help analyze bundle content',
      '--skip-plugins': `comma-separated list of plugin names to skip for this run`,
      '--watch': `watch for changes`,
      '--stdin': `close when stdin ends`
    }
  }, async (args, rawArgs) => {
    for (const key in defaults) {
      if (args[key] == null) {
        args[key] = defaults[key]
      }
    }
    args.entry = args.entry || args._[0]
    if (args.target !== 'app') {
      args.entry = args.entry || 'src/App.vue'
    }

    process.env.VUE_CLI_BUILD_TARGET = args.target

    const { log, execa } = require('@vue/cli-shared-utils')
    const { allProjectTargetsSupportModule } = require('../../util/targets')

    let needsDifferentialLoading = args.target === 'app' && args.module
    if (allProjectTargetsSupportModule) {
      log(
        `All browser targets in the browserslist configuration have supported ES module.\n` +
        `Therefore we don't build two separate bundles for differential loading.\n`
      )
      needsDifferentialLoading = false
    }

    args.needsDifferentialLoading = needsDifferentialLoading
    if (!needsDifferentialLoading) {
      await build(args, api, options)
      return
    }

    process.env.VUE_CLI_MODERN_MODE = true
    if (!process.env.VUE_CLI_MODERN_BUILD) {
      // main-process for legacy build
      const legacyBuildArgs = { ...args, moduleBuild: false, keepAlive: true }
      await build(legacyBuildArgs, api, options)

      // spawn sub-process of self for modern build
      const cliBin = require('path').resolve(__dirname, '../../../bin/vue-cli-service.js')
      await execa('node', [cliBin, 'build', ...rawArgs], {
        stdio: 'inherit',
        env: {
          VUE_CLI_MODERN_BUILD: true
        }
      })
    } else {
      // sub-process for modern build
      const moduleBuildArgs = { ...args, moduleBuild: true, clean: false }
      await build(moduleBuildArgs, api, options)
    }
  })
}

async function build (args, api, options) {
  const fs = require('fs-extra')
  const path = require('path')
  const webpack = require('webpack')
  const { chalk } = require('@vue/cli-shared-utils')
  const formatStats = require('./formatStats')
  const validateWebpackConfig = require('../../util/validateWebpackConfig')
  const {
    log,
    done,
    info,
    logWithSpinner,
    stopSpinner
  } = require('@vue/cli-shared-utils')

  log()
  const mode = api.service.mode
  if (args.target === 'app') {
    const bundleTag = args.needsDifferentialLoading
      ? args.moduleBuild
        ? `module bundle `
        : `legacy bundle `
      : ``
    logWithSpinner(`Building ${bundleTag}for ${mode}...`)
  } else {
    const buildMode = buildModes[args.target]
    if (buildMode) {
      const additionalParams = buildMode === 'library' ? ` (${args.formats})` : ``
      logWithSpinner(`Building for ${mode} as ${buildMode}${additionalParams}...`)
    } else {
      throw new Error(`Unknown build target: ${args.target}`)
    }
  }

  if (args.dest) {
    // Override outputDir before resolving webpack config as config relies on it (#2327)
    options.outputDir = args.dest
  }

  const targetDir = api.resolve(options.outputDir)
  const isLegacyBuild = args.needsDifferentialLoading && !args.moduleBuild

  // resolve raw webpack config
  let webpackConfig
  if (args.target === 'lib') {
    webpackConfig = require('./resolveLibConfig')(api, args, options)
  } else if (
    args.target === 'wc' ||
    args.target === 'wc-async'
  ) {
    webpackConfig = require('./resolveWcConfig')(api, args, options)
  } else {
    webpackConfig = require('./resolveAppConfig')(api, args, options)
  }

  // check for common config errors
  validateWebpackConfig(webpackConfig, api, options, args.target)

  if (args.watch) {
    modifyConfig(webpackConfig, config => {
      config.watch = true
    })
  }

  if (args.stdin) {
    process.stdin.on('end', () => {
      process.exit(0)
    })
    process.stdin.resume()
  }

  // Expose advanced stats
  if (args.dashboard) {
    const DashboardPlugin = require('../../webpack/DashboardPlugin')
    modifyConfig(webpackConfig, config => {
      config.plugins.push(new DashboardPlugin({
        type: 'build',
        moduleBuild: args.moduleBuild,
        keepAlive: args.keepAlive
      }))
    })
  }

  if (args.report || args['report-json']) {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
    modifyConfig(webpackConfig, config => {
      const bundleName = args.target !== 'app'
        ? config.output.filename.replace(/\.js$/, '-')
        : isLegacyBuild ? 'legacy-' : ''
      config.plugins.push(new BundleAnalyzerPlugin({
        logLevel: 'warn',
        openAnalyzer: false,
        analyzerMode: args.report ? 'static' : 'disabled',
        reportFilename: `${bundleName}report.html`,
        statsFilename: `${bundleName}report.json`,
        generateStatsFile: !!args['report-json']
      }))
    })
  }

  if (args.clean) {
    await fs.emptyDir(targetDir)
  }

  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      stopSpinner(false)
      if (err) {
        return reject(err)
      }

      if (stats.hasErrors()) {
        return reject(new Error('Build failed with errors.'))
      }

      if (!args.silent) {
        const targetDirShort = path.relative(
          api.service.context,
          targetDir
        )
        log(formatStats(stats, targetDirShort, api))
        if (args.target === 'app' && !isLegacyBuild) {
          if (!args.watch) {
            done(`Build complete. The ${chalk.cyan(targetDirShort)} directory is ready to be deployed.`)
            info(`Check out deployment instructions at ${chalk.cyan(`https://cli.vuejs.org/guide/deployment.html`)}\n`)
          } else {
            done(`Build complete. Watching for changes...`)
          }
        }
      }

      // test-only signal
      if (process.env.VUE_CLI_TEST) {
        console.log('Build complete.')
      }

      resolve()
    })
  })
}

module.exports.defaultModes = {
  build: 'production'
}
