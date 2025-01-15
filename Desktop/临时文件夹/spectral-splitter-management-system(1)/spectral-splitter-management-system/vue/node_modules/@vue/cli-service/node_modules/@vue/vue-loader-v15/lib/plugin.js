const { testWebpack5 } = require('./codegen/utils')
const NS = 'vue-loader'
class VueLoaderPlugin {
  apply(compiler) {
    let Ctor = null
    if (testWebpack5(compiler)) {
      // webpack5 and upper
      Ctor = require('./plugin-webpack5')
    } else {
      // webpack4 and lower
      Ctor = require('./plugin-webpack4')
    }
    new Ctor().apply(compiler)
  }
}
VueLoaderPlugin.NS = NS
module.exports = VueLoaderPlugin
