import _Object$getOwnPropertySymbols from "core-js-pure/features/object/get-own-property-symbols.js";
import _indexOfInstanceProperty from "core-js-pure/features/instance/index-of.js";
import objectWithoutPropertiesLoose from "./objectWithoutPropertiesLoose.js";
export default function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = objectWithoutPropertiesLoose(source, excluded);
  var key, i;
  if (_Object$getOwnPropertySymbols) {
    var sourceSymbolKeys = _Object$getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (_indexOfInstanceProperty(excluded).call(excluded, key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
}