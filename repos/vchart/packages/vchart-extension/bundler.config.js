
/**
 * @type {import('@internal/bundler').Config}
 */
module.exports = {
  name: 'VChartExtension',
  formats: ['es', 'cjs', 'umd'],
  outputDir: {
    es: 'esm',
    cjs: 'cjs',
    umd: 'build'
  },
  umdOutputFilename: 'index',
  noEmitOnError: false,
  envs: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
  },
  globals: {
    '@visactor/vchart': 'VChart',
    // 确保这些 vrender 相关的包在全局环境中可用
    '@visactor/vrender-core': 'VRender',
    '@visactor/vrender-components': 'VRenderComponents',
    '@visactor/vrender-kits': 'VRenderKits',
    '@visactor/vrender-animate': 'VRenderAnimate',
    // 其他依赖包
    '@visactor/vlayouts': 'VLayouts',
    '@visactor/vdataset': 'VDataset',
    '@visactor/vutils': 'VUtils'
  },
  external: [
    '@visactor/vchart',
    // vchart 已经引入了 下面这些包， 这里不需要再打包
    '@visactor/vlayouts',
    '@visactor/vdataset',
    '@visactor/vutils',
    '@visactor/vrender-core',
    '@visactor/vrender-components',
    '@visactor/vrender-kits',
    '@visactor/vrender-animate']
};
