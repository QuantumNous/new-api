module.exports = (api, options) => {
  require('@vue/cli-plugin-router/generator')(api, {
    historyMode: options.routerHistoryMode
  })
}
