module.exports = (api) => {
  if (api.hasPlugin('vue-next')) {
    api.extendPackage({
      devDependencies: {
        'vue-cli-plugin-vue-next': null
      }
    },
    {
      prune: true
    })

    api.exitLog('vue-cli-plugin-vue-next is removed because Vue 3 support has been built into the core plugins.')
  }

  // TODO: lint-staged update
}
