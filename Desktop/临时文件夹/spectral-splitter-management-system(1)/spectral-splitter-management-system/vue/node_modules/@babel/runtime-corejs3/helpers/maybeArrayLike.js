var _Array$isArray = require("core-js-pure/features/array/is-array.js");
var arrayLikeToArray = require("./arrayLikeToArray.js");
function _maybeArrayLike(next, arr, i) {
  if (arr && !_Array$isArray(arr) && typeof arr.length === "number") {
    var len = arr.length;
    return arrayLikeToArray(arr, i !== void 0 && i < len ? i : len);
  }
  return next(arr, i);
}
module.exports = _maybeArrayLike, module.exports.__esModule = true, module.exports["default"] = module.exports;