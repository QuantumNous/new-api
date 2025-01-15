module.exports = (api, options = {}, rootOptions = {}) => {
  const isVue3 = (rootOptions.vueVersion === '3')

  api.injectImports(api.entryFile, `import router from './router'`)

  if (isVue3) {
    api.transformScript(api.entryFile, require('./injectUseRouter'))
    api.extendPackage({
      dependencies: {
        'vue-router': '^4.0.3'
      }
    })
  } else {
    api.injectRootOptions(api.entryFile, `router`)

    api.extendPackage({
      dependencies: {
        'vue-router': '^3.5.1'
      }
    })
  }

  api.render('./template', {
    historyMode: options.historyMode,
    doesCompile: api.hasPlugin('babel') || api.hasPlugin('typescript'),
    hasTypeScript: api.hasPlugin('typescript')
  })

  if (isVue3) {
    api.render('./template-vue3', {
      historyMode: options.historyMode,
      doesCompile: api.hasPlugin('babel') || api.hasPlugin('typescript'),
      hasTypeScript: api.hasPlugin('typescript')
    })
  }

  if (api.invoking) {
    if (api.hasPlugin('typescript')) {
      /* eslint-disable-next-line node/no-extraneous-require */
      const convertFiles = require('@vue/cli-plugin-typescript/generator/convert')
      convertFiles(api)
    }
  }
}
