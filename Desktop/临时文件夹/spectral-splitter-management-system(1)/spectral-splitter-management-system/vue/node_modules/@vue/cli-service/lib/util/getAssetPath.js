const path = require('path')

module.exports = function getAssetPath (options, filePath) {
  return options.assetsDir
    ? path.posix.join(options.assetsDir, filePath)
    : filePath
}
