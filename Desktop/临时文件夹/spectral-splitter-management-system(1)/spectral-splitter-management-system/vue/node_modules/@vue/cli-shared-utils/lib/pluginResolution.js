const pluginRE = /^(@vue\/|vue-|@[\w-]+(\.)?[\w-]+\/vue-)cli-plugin-/
const scopeRE = /^@[\w-]+(\.)?[\w-]+\//
const officialRE = /^@vue\//

const officialPlugins = [
  'babel',
  'e2e-cypress',
  'e2e-nightwatch',
  'e2e-webdriverio',
  'eslint',
  'pwa',
  'router',
  'typescript',
  'unit-jest',
  'unit-mocha',
  'vuex',
  'webpack-4'
]

exports.isPlugin = id => pluginRE.test(id)

exports.isOfficialPlugin = id => exports.isPlugin(id) && officialRE.test(id)

exports.toShortPluginId = id => id.replace(pluginRE, '')

exports.resolvePluginId = id => {
  // already full id
  // e.g. vue-cli-plugin-foo, @vue/cli-plugin-foo, @bar/vue-cli-plugin-foo
  if (pluginRE.test(id)) {
    return id
  }

  if (id === '@vue/cli-service') {
    return id
  }

  if (officialPlugins.includes(id)) {
    return `@vue/cli-plugin-${id}`
  }
  // scoped short
  // e.g. @vue/foo, @bar/foo
  if (id.charAt(0) === '@') {
    const scopeMatch = id.match(scopeRE)
    if (scopeMatch) {
      const scope = scopeMatch[0]
      const shortId = id.replace(scopeRE, '')
      return `${scope}${scope === '@vue/' ? `` : `vue-`}cli-plugin-${shortId}`
    }
  }
  // default short
  // e.g. foo
  return `vue-cli-plugin-${id}`
}

exports.matchesPluginId = (input, full) => {
  const short = full.replace(pluginRE, '')
  return (
    // input is full
    full === input ||
    // input is short without scope
    short === input ||
    // input is short with scope
    short === input.replace(scopeRE, '')
  )
}

exports.getPluginLink = id => {
  if (officialRE.test(id)) {
    return `https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-${
      exports.toShortPluginId(id)
    }`
  }
  let pkg = {}
  try {
    pkg = require(`${id}/package.json`)
  } catch (e) {}
  return (
    pkg.homepage ||
    (pkg.repository && pkg.repository.url) ||
    `https://www.npmjs.com/package/${id.replace(`/`, `%2F`)}`
  )
}
