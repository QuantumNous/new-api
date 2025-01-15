var _Object$keys = require("core-js-pure/features/object/keys.js");
var _Object$getOwnPropertySymbols = require("core-js-pure/features/object/get-own-property-symbols.js");
var _filterInstanceProperty = require("core-js-pure/features/instance/filter.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
var _pushInstanceProperty = require("core-js-pure/features/instance/push.js");
var _forEachInstanceProperty = require("core-js-pure/features/instance/for-each.js");
var _Object$getOwnPropertyDescriptors = require("core-js-pure/features/object/get-own-property-descriptors.js");
var _Object$defineProperties = require("core-js-pure/features/object/define-properties.js");
var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
var defineProperty = require("./defineProperty.js");
function ownKeys(e, r) {
  var t = _Object$keys(e);
  if (_Object$getOwnPropertySymbols) {
    var o = _Object$getOwnPropertySymbols(e);
    r && (o = _filterInstanceProperty(o).call(o, function (r) {
      return _Object$getOwnPropertyDescriptor(e, r).enumerable;
    })), _pushInstanceProperty(t).apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var _context, _context2;
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? _forEachInstanceProperty(_context = ownKeys(Object(t), !0)).call(_context, function (r) {
      defineProperty(e, r, t[r]);
    }) : _Object$getOwnPropertyDescriptors ? _Object$defineProperties(e, _Object$getOwnPropertyDescriptors(t)) : _forEachInstanceProperty(_context2 = ownKeys(Object(t))).call(_context2, function (r) {
      _Object$defineProperty(e, r, _Object$getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
module.exports = _objectSpread2, module.exports.__esModule = true, module.exports["default"] = module.exports;