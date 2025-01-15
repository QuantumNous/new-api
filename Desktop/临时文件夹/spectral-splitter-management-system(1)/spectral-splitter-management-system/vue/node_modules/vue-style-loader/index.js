/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
  Modified by Evan You @yyx990803
*/
var loaderUtils = require('loader-utils')
var path = require('path')
var hash = require('hash-sum')
var qs = require('querystring')

module.exports = function () {}

module.exports.pitch = function (remainingRequest) {
  var isServer = this.target === 'node'
  var isProduction = this.minimize || process.env.NODE_ENV === 'production'
  var addStylesClientPath = loaderUtils.stringifyRequest(this, '!' + path.join(__dirname, 'lib/addStylesClient.js'))
  var addStylesServerPath = loaderUtils.stringifyRequest(this, '!' + path.join(__dirname, 'lib/addStylesServer.js'))
  var addStylesShadowPath = loaderUtils.stringifyRequest(this, '!' + path.join(__dirname, 'lib/addStylesShadow.js'))

  var request = loaderUtils.stringifyRequest(this, '!!' + remainingRequest)
  var relPath = path.relative(__dirname, this.resourcePath).replace(/\\/g, '/')
  var id = JSON.stringify(hash(request + relPath))
  var options = loaderUtils.getOptions(this) || {}

  // direct css import from js --> direct, or manually call `styles.__inject__(ssrContext)` with `manualInject` option
  // css import from vue file --> component lifecycle linked
  // style embedded in vue file --> component lifecycle linked
  var isVue = (
    /"vue":true/.test(remainingRequest) ||
    options.manualInject ||
    qs.parse(this.resourceQuery.slice(1)).vue != null
  )

  var shared = [
    '// style-loader: Adds some css to the DOM by adding a <style> tag',
    '',
    '// load the styles',
    'var content = require(' + request + ');',
    // get default export if list is an ES Module (CSS Loader v4+)
    "if(content.__esModule) content = content.default;",
    // content list format is [id, css, media, sourceMap]
    "if(typeof content === 'string') content = [[module.id, content, '']];",
    'if(content.locals) module.exports = content.locals;'
  ]

  // shadowMode is enabled in vue-cli with vue build --target web-component.
  // exposes the same __inject__ method like SSR
  if (options.shadowMode) {
    return shared.concat([
      '// add CSS to Shadow Root',
      'var add = require(' + addStylesShadowPath + ').default',
      'module.exports.__inject__ = function (shadowRoot) {',
      '  add(' + id + ', content, shadowRoot)',
      '};'
    ]).join('\n')
  } else if (!isServer) {
    // on the client: dynamic inject + hot-reload
    var code = [
      '// add the styles to the DOM',
      'var add = require(' + addStylesClientPath + ').default',
      'var update = add(' + id + ', content, ' + isProduction + ', ' + JSON.stringify(options) + ');'
    ]
    if (!isProduction) {
      code = code.concat([
        '// Hot Module Replacement',
        'if(module.hot) {',
        ' // When the styles change, update the <style> tags',
        ' if(!content.locals) {',
        '   module.hot.accept(' + request + ', function() {',
        '     var newContent = require(' + request + ');',
        '     if(newContent.__esModule) newContent = newContent.default;',
        "     if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];",
        '     update(newContent);',
        '   });',
        ' }',
        ' // When the module is disposed, remove the <style> tags',
        ' module.hot.dispose(function() { update(); });',
        '}'
      ])
    }
    return shared.concat(code).join('\n')
  } else {
    // on the server: attach to Vue SSR context
    if (isVue) {
      // inside *.vue file: expose a function so it can be called in
      // component's lifecycle hooks
      return shared.concat([
        '// add CSS to SSR context',
        'var add = require(' + addStylesServerPath + ').default',
        'module.exports.__inject__ = function (context) {',
        '  add(' + id + ', content, ' + isProduction + ', context)',
        '};'
      ]).join('\n')
    } else {
      // normal import
      return shared.concat([
        'require(' + addStylesServerPath + ').default(' + id + ', content, ' + isProduction + ')'
      ]).join('\n')
    }
  }
}
