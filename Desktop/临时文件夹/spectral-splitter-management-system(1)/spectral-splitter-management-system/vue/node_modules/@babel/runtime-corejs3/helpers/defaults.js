var _Object$getOwnPropertyNames = require("core-js-pure/features/object/get-own-property-names.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
function _defaults(obj, defaults) {
  var keys = _Object$getOwnPropertyNames(defaults);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = _Object$getOwnPropertyDescriptor(defaults, key);
    if (value && value.configurable && obj[key] === undefined) {
      _Object$defineProperty(obj, key, value);
    }
  }
  return obj;
}
module.exports = _defaults, module.exports.__esModule = true, module.exports["default"] = module.exports;