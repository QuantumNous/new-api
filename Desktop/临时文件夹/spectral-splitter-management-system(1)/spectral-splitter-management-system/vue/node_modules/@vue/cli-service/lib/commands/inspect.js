module.exports = (api, options) => {
  api.registerCommand(
    'inspect',
    {
      description: 'inspect internal webpack config',
      usage: 'vue-cli-service inspect [options] [...paths]',
      options: {
        '--mode': 'specify env mode (default: development)',
        '--rule <ruleName>': 'inspect a specific module rule',
        '--plugin <pluginName>': 'inspect a specific plugin',
        '--rules': 'list all module rule names',
        '--plugins': 'list all plugin names',
        '--verbose': 'show full function definitions in output',
        '--skip-plugins': 'comma-separated list of plugin names to skip for this run'
      }
    },
    args => {
      const { chalk, get } = require('@vue/cli-shared-utils')
      const { toString } = require('webpack-chain')
      const { highlight } = require('cli-highlight')
      const config = api.resolveWebpackConfig()
      const { _: paths, verbose } = args

      let res
      let hasUnnamedRule
      if (args.rule) {
        res = config.module.rules.find(r => r.__ruleNames[0] === args.rule)
      } else if (args.plugin) {
        res = config.plugins.find(p => p.__pluginName === args.plugin)
      } else if (args.rules) {
        res = config.module.rules.map(r => {
          const name = r.__ruleNames ? r.__ruleNames[0] : 'Nameless Rule (*)'

          hasUnnamedRule = hasUnnamedRule || !r.__ruleNames

          return name
        })
      } else if (args.plugins) {
        res = config.plugins.map(p => p.__pluginName || p.constructor.name)
      } else if (paths.length > 1) {
        res = {}
        paths.forEach(path => {
          res[path] = get(config, path)
        })
      } else if (paths.length === 1) {
        res = get(config, paths[0])
      } else {
        res = config
      }

      const output = toString(res, { verbose })
      console.log(highlight(output, { language: 'js' }))

      // Log explanation for Nameless Rules
      if (hasUnnamedRule) {
        console.log(`--- ${chalk.green('Footnotes')} ---`)
        console.log(`*: ${chalk.green(
          'Nameless Rules'
        )} were added through the ${chalk.green(
          'configureWebpack()'
        )} API (possibly by a plugin) instead of ${chalk.green(
          'chainWebpack()'
        )} (recommended).
    You can run ${chalk.green(
    'vue-cli-service inspect'
  )} without any arguments to inspect the full config and read these rules' config.`)
      }
    }
  )
}

module.exports.defaultModes = {
  inspect: 'development'
}
