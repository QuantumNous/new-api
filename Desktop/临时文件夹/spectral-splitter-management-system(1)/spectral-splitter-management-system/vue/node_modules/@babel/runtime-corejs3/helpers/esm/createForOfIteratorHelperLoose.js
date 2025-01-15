import _Symbol from "core-js-pure/features/symbol/index.js";
import _getIteratorMethod from "core-js-pure/features/get-iterator-method.js";
import _bindInstanceProperty from "core-js-pure/features/instance/bind.js";
import _Array$isArray from "core-js-pure/features/array/is-array.js";
import unsupportedIterableToArray from "./unsupportedIterableToArray.js";
export default function _createForOfIteratorHelperLoose(o, allowArrayLike) {
  var _context;
  var it = typeof _Symbol !== "undefined" && _getIteratorMethod(o) || o["@@iterator"];
  if (it) return _bindInstanceProperty(_context = (it = it.call(o)).next).call(_context, it);
  if (_Array$isArray(o) || (it = unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it) o = it;
    var i = 0;
    return function () {
      if (i >= o.length) return {
        done: true
      };
      return {
        done: false,
        value: o[i++]
      };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}