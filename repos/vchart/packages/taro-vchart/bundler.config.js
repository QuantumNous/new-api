/**
 * @type {import('@internal/bundler').Config}
 */
module.exports = {
  name: 'TaroVChart',
  formats: ['es', 'cjs'],
  outputDir: {
    es: 'esm',
    cjs: 'cjs',
  },
  umdOutputFilename: 'index',
  noEmitOnError: false,
  globals: {
    '@visactor/vchart': 'VChart',
    '@visactor/vutils': 'VUtils'
  },
  external: ['@visactor/vchart', '@visactor/vutils']
};
