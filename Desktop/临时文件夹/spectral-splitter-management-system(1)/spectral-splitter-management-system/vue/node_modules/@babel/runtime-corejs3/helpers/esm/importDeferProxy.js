import _Reflect$get from "core-js-pure/features/reflect/get.js";
import _Reflect$getOwnPropertyDescriptor from "core-js-pure/features/reflect/get-own-property-descriptor.js";
import _Reflect$has from "core-js-pure/features/reflect/has.js";
import _Reflect$ownKeys from "core-js-pure/features/reflect/own-keys.js";
export default function _importDeferProxy(e) {
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