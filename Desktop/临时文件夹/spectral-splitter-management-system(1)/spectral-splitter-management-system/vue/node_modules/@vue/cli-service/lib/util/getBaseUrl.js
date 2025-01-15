module.exports = function getBaseUrl (options) {
  return options.publicPath === 'auto' ? '' : options.publicPath
}
