const path = require('path')

const camelizeRE = /-(\w)/g
const camelize = str => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
}

const hyphenateRE = /\B([A-Z])/g
const hyphenate = str => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
}

/**
 * Creates the script to add the component to the custom elements
 * @param {string} prefix The prefix for the component library
 * @param {string} component The component name for single entry builds, component file for multi-entry builds
 * @param {string} file The file for the component
 * @param {boolean} isAsync Whether to load component async or not
 */
const createElement = (prefix, component, file, isAsync) => {
  const { camelName, kebabName } = exports.fileToComponentName(prefix, component)

  return isAsync
    ? `window.customElements.define('${kebabName}', wrap(Vue, () => import('~root/${file}?shadow')))\n`
    : `import ${camelName} from '~root/${file}?shadow'\n` +
        `window.customElements.define('${kebabName}', wrap(Vue, ${camelName}))\n`
}

exports.fileToComponentName = (prefix, file) => {
  const basename = path.basename(file).replace(/\.(jsx?|vue)$/, '')
  const camelName = camelize(basename)
  const kebabName = `${prefix ? `${prefix}-` : ``}${hyphenate(basename)}`
  return {
    basename,
    camelName,
    kebabName
  }
}

exports.resolveEntry = (prefix, libName, files, isAsync) => {
  const filePath = path.resolve(__dirname, 'entry-wc.js')
  const elements =
    prefix === ''
      ? [createElement('', libName, files[0])]
      : files.map(file => createElement(prefix, file, file, isAsync)).join('\n')

  function resolveImportPath (mod) {
    return require.resolve(mod).replace(/\\/g, '\\\\')
  }

  const content = `
import './setPublicPath'
import Vue from 'vue'
import wrap from '@vue/web-component-wrapper'

// runtime shared by every component chunk
import '${resolveImportPath('css-loader/dist/runtime/api.js')}'
import '${resolveImportPath('vue-style-loader/lib/addStylesShadow')}'
import '${resolveImportPath('@vue/vue-loader-v15/lib/runtime/componentNormalizer')}'

${elements}`.trim()

  return {
    filePath: filePath,
    content: content
  }
}
