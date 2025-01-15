var _Reflect$get = require("core-js-pure/features/reflect/get.js");
var _Reflect$getOwnPropertyDescriptor = require("core-js-pure/features/reflect/get-own-property-descriptor.js");
var _Reflect$has = require("core-js-pure/features/reflect/has.js");
var _Reflect$ownKeys = require("core-js-pure/features/reflect/own-keys.js");
function _importDeferProxy(e) {
  var t = null,
    constValue = function constValue(e) {
      return function () {
        return e;
      };
    },
    proxy = function proxy(r) {
      return function (n, o, f) {
        return null === t && (t = e()), r(t, o, f);
      };
    };
  return new Proxy({}, {
    defineProperty: constValue(!1),
    deleteProperty: constValue(!1),
    get: proxy(_Reflect$get),
    getOwnPropertyDescriptor: proxy(_Reflect$getOwnPropertyDescriptor),
    getPrototypeOf: constValue(null),
    isExtensible: constValue(!1),
    has: proxy(_Reflect$has),
    ownKeys: proxy(_Reflect$ownKeys),
    preventExtensions: constValue(!0),
    set: constValue(!1),
    setPrototypeOf: constValue(!1)
  });
}
module.exports = _importDeferProxy, module.exports.__esModule = true, module.exports["default"] = module.exports;