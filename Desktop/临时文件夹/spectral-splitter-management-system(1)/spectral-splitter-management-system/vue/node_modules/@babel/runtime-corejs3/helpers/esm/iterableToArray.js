import _Symbol from "core-js-pure/features/symbol/index.js";
import _getIteratorMethod from "core-js-pure/features/get-iterator-method.js";
import _Array$from from "core-js-pure/features/array/from.js";
export default function _iterableToArray(iter) {
  if (typeof _Symbol !== "undefined" && _getIteratorMethod(iter) != null || iter["@@iterator"] != null) return _Array$from(iter);
}