import _Object$keys from "core-js-pure/features/object/keys.js";
import _Object$getOwnPropertySymbols from "core-js-pure/features/object/get-own-property-symbols.js";
import _filterInstanceProperty from "core-js-pure/features/instance/filter.js";
import _Object$getOwnPropertyDescriptor from "core-js-pure/features/object/get-own-property-descriptor.js";
import _pushInstanceProperty from "core-js-pure/features/instance/push.js";
import _forEachInstanceProperty from "core-js-pure/features/instance/for-each.js";
import _Object$getOwnPropertyDescriptors from "core-js-pure/features/object/get-own-property-descriptors.js";
import _Object$defineProperties from "core-js-pure/features/object/define-properties.js";
import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
import defineProperty from "./defineProperty.js";
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
export default function _objectSpread2(e) {
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