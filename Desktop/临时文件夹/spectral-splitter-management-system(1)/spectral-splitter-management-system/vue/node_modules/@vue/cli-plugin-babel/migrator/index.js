const { chalk } = require('@vue/cli-shared-utils')

module.exports = api => {
  api.transformScript(
    'babel.config.js',
    require('../codemods/usePluginPreset')
  )

  if (api.fromVersion('^3')) {
    api.extendPackage(
      {
        dependencies: {
          'core-js': '^3.8.3'
        }
      },
      { warnIncompatibleVersions: false }
    )

    // TODO: implement a codemod to migrate polyfills
    api.exitLog(`core-js has been upgraded from v2 to v3.
If you have any custom polyfills defined in ${chalk.yellow('babel.config.js')}, please be aware their names may have been changed.
For more complete changelog, see https://github.com/zloirock/core-js/blob/master/CHANGELOG.md#300---20190319`)
  }
}
