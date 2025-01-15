/* eslint-disable no-var */
// This file is imported into lib/wc client bundles.

if (typeof window !== 'undefined') {
  var currentScript = window.document.currentScript
  if (process.env.NEED_CURRENTSCRIPT_POLYFILL) {
    var getCurrentScript = require('@soda/get-current-script')
    currentScript = getCurrentScript()

    // for backward compatibility, because previously we directly included the polyfill
    if (!('currentScript' in document)) {
      Object.defineProperty(document, 'currentScript', { get: getCurrentScript })
    }
  }

  var src = currentScript && currentScript.src.match(/(.+\/)[^/]+\.js(\?.*)?$/)
  if (src) {
    __webpack_public_path__ = src[1] // eslint-disable-line
  }
}

// Indicate to webpack that this file can be concatenated
export default null
