var _Reflect$get = require("core-js-pure/features/reflect/get.js");
var _bindInstanceProperty = require("core-js-pure/features/instance/bind.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
var superPropBase = require("./superPropBase.js");
function _get() {
  if (typeof Reflect !== "undefined" && _Reflect$get) {
    var _context;
    module.exports = _get = _bindInstanceProperty(_context = _Reflect$get).call(_context), module.exports.__esModule = true, module.exports["default"] = module.exports;
  } else {
    module.exports = _get = function _get(target, property, receiver) {
      var base = superPropBase(target, property);
      if (!base) return;
      var desc = _Object$getOwnPropertyDescriptor(base, property);
      if (desc.get) {
        return desc.get.call(arguments.length < 3 ? target : receiver);
      }
      return desc.value;
    }, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
  return _get.apply(this, arguments);
}
module.exports = _get, module.exports.__esModule = true, module.exports["default"] = module.exports;