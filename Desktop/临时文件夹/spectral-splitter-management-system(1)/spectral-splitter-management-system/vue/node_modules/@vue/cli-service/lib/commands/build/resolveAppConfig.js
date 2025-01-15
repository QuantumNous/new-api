module.exports = (api, args, options) => {
  // respect inline entry
  if (args.entry && !options.pages) {
    api.configureWebpack(config => {
      config.entry = { app: api.resolve(args.entry) }
    })
  }

  const config = api.resolveChainableWebpackConfig()
  const targetDir = api.resolve(args.dest || options.outputDir)

  // respect inline build destination in copy plugin
  if (args.dest && config.plugins.has('copy')) {
    config.plugin('copy').tap(pluginArgs => {
      pluginArgs[0].patterns.to = targetDir
      return pluginArgs
    })
  }

  if (process.env.VUE_CLI_MODERN_MODE) {
    const ModernModePlugin = require('../../webpack/ModernModePlugin')
    const SafariNomoduleFixPlugin = require('../../webpack/SafariNomoduleFixPlugin')

    if (!args.moduleBuild) {
      // Inject plugin to extract build stats and write to disk
      config
        .plugin('modern-mode-legacy')
        .use(ModernModePlugin, [{
          targetDir,
          isModuleBuild: false
        }])
    } else {
      config
        .plugin('safari-nomodule-fix')
        .use(SafariNomoduleFixPlugin, [{
          // as we may generate an addition file asset (if Safari 10 fix is needed)
          // we need to provide the correct directory for that file to place in
          jsDirectory: require('../../util/getAssetPath')(options, 'js')
        }])

      // Inject plugin to read non-modern build stats and inject HTML
      config
        .plugin('modern-mode-modern')
        .use(ModernModePlugin, [{
          targetDir,
          isModuleBuild: true
        }])
    }
  }

  return api.resolveWebpackConfig(config)
}
