var _Object$keys = require("core-js-pure/features/object/keys.js");
var _Object$getOwnPropertySymbols = require("core-js-pure/features/object/get-own-property-symbols.js");
var _pushInstanceProperty = require("core-js-pure/features/instance/push.js");
var _filterInstanceProperty = require("core-js-pure/features/instance/filter.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
var _forEachInstanceProperty = require("core-js-pure/features/instance/for-each.js");
var defineProperty = require("./defineProperty.js");
function _objectSpread(target) {
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
module.exports = _objectSpread, module.exports.__esModule = true, module.exports["default"] = module.exports;