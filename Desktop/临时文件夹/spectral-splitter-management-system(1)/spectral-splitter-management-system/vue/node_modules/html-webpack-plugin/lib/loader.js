/* This loader renders the template with underscore if no other loader was found */
// @ts-nocheck
'use strict';
const _ = require('lodash');

module.exports = function (source) {
  // Get templating options
  const options = this.getOptions();
  const force = options.force || false;

  const allLoadersButThisOne = this.loaders.filter((loader) => loader.normal !== module.exports);

  // This loader shouldn't kick in if there is any other loader (unless it's explicitly enforced)
  if (allLoadersButThisOne.length > 0 && !force) {
    return source;
  }

  // Allow only one html-webpack-plugin loader to allow loader options in the webpack config
  const htmlWebpackPluginLoaders = this.loaders.filter((loader) => loader.normal === module.exports);
  const lastHtmlWebpackPluginLoader = htmlWebpackPluginLoaders[htmlWebpackPluginLoaders.length - 1];
  if (this.loaders[this.loaderIndex] !== lastHtmlWebpackPluginLoader) {
    return source;
  }

  // Skip .js files (unless it's explicitly enforced)
  if (/\.(c|m)?js$/.test(this.resourcePath) && !force) {
    return source;
  }

  // The following part renders the template with lodash as a minimalistic loader
  //
  const template = _.template(source, { interpolate: /<%=([\s\S]+?)%>/g, variable: 'data', ...options });
  // Use `eval("require")("lodash")` to enforce using the native nodejs require
  // during template execution
  return 'var _ = eval("require")(' + JSON.stringify(require.resolve('lodash')) + ');' +
    'module.exports = function (templateParams) { with(templateParams) {' +
      // Execute the lodash template
      'return (' + template.source + ')();' +
    '}}';
};
