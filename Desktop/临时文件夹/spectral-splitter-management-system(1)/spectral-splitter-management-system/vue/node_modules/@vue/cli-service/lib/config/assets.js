/** @type {import('@vue/cli-service').ServicePlugin} */
module.exports = (api, options) => {
  const getAssetPath = require('../util/getAssetPath')

  const genAssetSubPath = dir => {
    return getAssetPath(
      options,
      `${dir}/[name]${options.filenameHashing ? '.[hash:8]' : ''}[ext]`
    )
  }

  api.chainWebpack(webpackConfig => {
    webpackConfig.module
    .rule('svg')
      .test(/\.(svg)(\?.*)?$/)
      // do not base64-inline SVGs.
      // https://github.com/facebookincubator/create-react-app/pull/1180
      .set('type', 'asset/resource')
      .set('generator', {
        filename: genAssetSubPath('img')
      })

    webpackConfig.module
      .rule('images')
        .test(/\.(png|jpe?g|gif|webp|avif)(\?.*)?$/)
        .set('type', 'asset')
        .set('generator', {
          filename: genAssetSubPath('img')
        })

    webpackConfig.module
      .rule('media')
        .test(/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/)
        .set('type', 'asset')
        .set('generator', {
          filename: genAssetSubPath('media')
        })

    webpackConfig.module
      .rule('fonts')
        .test(/\.(woff2?|eot|ttf|otf)(\?.*)?$/i)
        .set('type', 'asset')
        .set('generator', {
          filename: genAssetSubPath('fonts')
        })
  })
}
