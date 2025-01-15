var _Object$getOwnPropertySymbols = require("core-js-pure/features/object/get-own-property-symbols.js");
var _indexOfInstanceProperty = require("core-js-pure/features/instance/index-of.js");
var objectWithoutPropertiesLoose = require("./objectWithoutPropertiesLoose.js");
function _objectWithoutProperties(source, excluded) {
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
module.exports = _objectWithoutProperties, module.exports.__esModule = true, module.exports["default"] = module.exports;