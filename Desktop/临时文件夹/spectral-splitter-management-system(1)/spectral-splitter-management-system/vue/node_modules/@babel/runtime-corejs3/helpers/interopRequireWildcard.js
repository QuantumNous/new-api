var _typeof = require("./typeof.js")["default"];
var _WeakMap = require("core-js-pure/features/weak-map/index.js");
var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
function _getRequireWildcardCache(e) {
  if ("function" != typeof _WeakMap) return null;
  var r = new _WeakMap(),
    t = new _WeakMap();
  return (_getRequireWildcardCache = function _getRequireWildcardCache(e) {
    return e ? t : r;
  })(e);
}
function _interopRequireWildcard(e, r) {
  if (!r && e && e.__esModule) return e;
  if (null === e || "object" != _typeof(e) && "function" != typeof e) return {
    "default": e
  };
  var t = _getRequireWildcardCache(r);
  if (t && t.has(e)) return t.get(e);
  var n = {
      __proto__: null
    },
    a = _Object$defineProperty && _Object$getOwnPropertyDescriptor;
  for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) {
    var i = a ? _Object$getOwnPropertyDescriptor(e, u) : null;
    i && (i.get || i.set) ? _Object$defineProperty(n, u, i) : n[u] = e[u];
  }
  return n["default"] = e, t && t.set(e, n), n;
}
module.exports = _interopRequireWildcard, module.exports.__esModule = true, module.exports["default"] = module.exports;