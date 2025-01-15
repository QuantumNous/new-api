var _sliceInstanceProperty = require("core-js-pure/features/instance/slice.js");
var _Array$from = require("core-js-pure/features/array/from.js");
var arrayLikeToArray = require("./arrayLikeToArray.js");
function _unsupportedIterableToArray(o, minLen) {
  var _context;
  if (!o) return;
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = _sliceInstanceProperty(_context = Object.prototype.toString.call(o)).call(_context, 8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return _Array$from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
}
module.exports = _unsupportedIterableToArray, module.exports.__esModule = true, module.exports["default"] = module.exports;