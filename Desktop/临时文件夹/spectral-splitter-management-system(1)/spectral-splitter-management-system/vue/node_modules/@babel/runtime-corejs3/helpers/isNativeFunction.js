var _indexOfInstanceProperty = require("core-js-pure/features/instance/index-of.js");
function _isNativeFunction(fn) {
  try {
    var _context;
    return _indexOfInstanceProperty(_context = Function.toString.call(fn)).call(_context, "[native code]") !== -1;
  } catch (e) {
    return typeof fn === "function";
  }
}
module.exports = _isNativeFunction, module.exports.__esModule = true, module.exports["default"] = module.exports;