const path = require('path')
const { chalk, warn, error } = require('@vue/cli-shared-utils')
const { validate } = require('../options')

function ensureSlash (config, key) {
  const val = config[key]
  if (typeof val === 'string') {
    config[key] = val.replace(/([^/])$/, '$1/')
  }
}

function removeSlash (config, key) {
  if (typeof config[key] === 'string') {
    config[key] = config[key].replace(/\/$/g, '')
  }
}

module.exports = function resolveUserConfig ({
  inlineOptions,
  pkgConfig,
  fileConfig,
  fileConfigPath
}) {
  if (fileConfig) {
    if (typeof fileConfig === 'function') {
      fileConfig = fileConfig()
    }

    if (!fileConfig || typeof fileConfig !== 'object') {
      throw new Error(
        `Error loading ${chalk.bold(fileConfigPath)}: ` +
        `should export an object or a function that returns object.`
      )
    }
  }

  // package.vue
  if (pkgConfig && typeof pkgConfig !== 'object') {
    throw new Error(
      `Error loading Vue CLI config in ${chalk.bold(`package.json`)}: ` +
      `the "vue" field should be an object.`
    )
  }

  let resolved, resolvedFrom
  if (fileConfig) {
    const configFileName = path.basename(fileConfigPath)
    if (pkgConfig) {
      warn(
        `"vue" field in package.json ignored ` +
        `due to presence of ${chalk.bold(configFileName)}.`
      )
      warn(
        `You should migrate it into ${chalk.bold(configFileName)} ` +
        `and remove it from package.json.`
      )
    }
    resolved = fileConfig
    resolvedFrom = configFileName
  } else if (pkgConfig) {
    resolved = pkgConfig
    resolvedFrom = '"vue" field in package.json'
  } else {
    resolved = inlineOptions || {}
    resolvedFrom = 'inline options'
  }

  // normalize some options
  if (resolved.publicPath !== 'auto') {
    ensureSlash(resolved, 'publicPath')
  }
  if (typeof resolved.publicPath === 'string') {
    resolved.publicPath = resolved.publicPath.replace(/^\.\//, '')
  }
  removeSlash(resolved, 'outputDir')

  // validate options
  validate(resolved, msg => {
    error(`Invalid options in ${chalk.bold(resolvedFrom)}: ${msg}`)
  })

  return resolved
}
