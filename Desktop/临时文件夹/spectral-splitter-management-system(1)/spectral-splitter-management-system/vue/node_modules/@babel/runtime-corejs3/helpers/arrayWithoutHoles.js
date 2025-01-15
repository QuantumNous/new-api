var _Array$isArray = require("core-js-pure/features/array/is-array.js");
var arrayLikeToArray = require("./arrayLikeToArray.js");
function _arrayWithoutHoles(arr) {
  if (_Array$isArray(arr)) return arrayLikeToArray(arr);
}
module.exports = _arrayWithoutHoles, module.exports.__esModule = true, module.exports["default"] = module.exports;