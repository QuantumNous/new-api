module.exports = (api, options = {}, rootOptions = {}) => {
  api.injectImports(api.entryFile, `import store from './store'`)

  if (rootOptions.vueVersion === '3') {
    api.transformScript(api.entryFile, require('./injectUseStore'))
    api.extendPackage({
      dependencies: {
        vuex: '^4.0.0'
      }
    })
    api.render('./template-vue3', {})
  } else {
    api.injectRootOptions(api.entryFile, `store`)

    api.extendPackage({
      dependencies: {
        vuex: '^3.6.2'
      }
    })

    api.render('./template', {})
  }

  if (api.invoking && api.hasPlugin('typescript')) {
    /* eslint-disable-next-line node/no-extraneous-require */
    const convertFiles = require('@vue/cli-plugin-typescript/generator/convert')
    convertFiles(api)
  }
}
