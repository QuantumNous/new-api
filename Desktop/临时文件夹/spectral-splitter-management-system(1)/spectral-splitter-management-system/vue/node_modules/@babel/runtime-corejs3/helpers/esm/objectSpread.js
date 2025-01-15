import _Object$keys from "core-js-pure/features/object/keys.js";
import _Object$getOwnPropertySymbols from "core-js-pure/features/object/get-own-property-symbols.js";
import _pushInstanceProperty from "core-js-pure/features/instance/push.js";
import _filterInstanceProperty from "core-js-pure/features/instance/filter.js";
import _Object$getOwnPropertyDescriptor from "core-js-pure/features/object/get-own-property-descriptor.js";
import _forEachInstanceProperty from "core-js-pure/features/instance/for-each.js";
import defineProperty from "./defineProperty.js";
export default function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? Object(arguments[i]) : {};
    var ownKeys = _Object$keys(source);
    if (typeof _Object$getOwnPropertySymbols === 'function') {
      var _context;
      _pushInstanceProperty(ownKeys).apply(ownKeys, _filterInstanceProperty(_context = _Object$getOwnPropertySymbols(source)).call(_context, function (sym) {
        return _Object$getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }
    _forEachInstanceProperty(ownKeys).call(ownKeys, function (key) {
      defineProperty(target, key, source[key]);
    });
  }
  return target;
}