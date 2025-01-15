var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
var _Object$getOwnPropertySymbols = require("core-js-pure/features/object/get-own-property-symbols.js");
function _defineEnumerableProperties(obj, descs) {
  for (var key in descs) {
    var desc = descs[key];
    desc.configurable = desc.enumerable = true;
    if ("value" in desc) desc.writable = true;
    _Object$defineProperty(obj, key, desc);
  }
  if (_Object$getOwnPropertySymbols) {
    var objectSymbols = _Object$getOwnPropertySymbols(descs);
    for (var i = 0; i < objectSymbols.length; i++) {
      var sym = objectSymbols[i];
      var desc = descs[sym];
      desc.configurable = desc.enumerable = true;
      if ("value" in desc) desc.writable = true;
      _Object$defineProperty(obj, sym, desc);
    }
  }
  return obj;
}
module.exports = _defineEnumerableProperties, module.exports.__esModule = true, module.exports["default"] = module.exports;