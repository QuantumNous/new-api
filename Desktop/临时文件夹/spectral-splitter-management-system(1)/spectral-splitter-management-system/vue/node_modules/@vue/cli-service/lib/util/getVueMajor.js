const { semver, loadModule } = require('@vue/cli-shared-utils')

/**
 * Get the major Vue version that the user project uses
 * @param {string} cwd the user project root
 * @returns {2|3}
 */
module.exports = function getVueMajor (cwd) {
  const vue = loadModule('vue', cwd)
  // TODO: make Vue 3 the default version
  const vueMajor = vue ? semver.major(vue.version) : 2
  return vueMajor
}
