/**
 * @type {Partial<import('@internal/bundler').Config>}
 */
module.exports = {
  name: 'Test',
  formats: ['umd'],

  umdOutputFilename: 'index',
  minify: false,

  external: [],

  globals: {}
};
