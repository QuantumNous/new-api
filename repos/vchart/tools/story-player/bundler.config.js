/**
 * @type {import('@internal/bundler').Config}
 */
module.exports = {
  name: 'StoryPlayer',
  formats: ['es', 'cjs', 'umd'],
  outputDir: {
    es: 'esm',
    cjs: 'cjs',
    umd: 'build',
  },
  umdOutputFilename: 'index',
  noEmitOnError: false,
  envs: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  external: ['@visactor/vchart', '@visactor/vrender-core', '@visactor/vrender-kits', '@visactor/vutils'],
};
