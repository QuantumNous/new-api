import _Symbol from "core-js-pure/features/symbol/index.js";
import _Symbol$iterator from "core-js-pure/features/symbol/iterator.js";
export default function _typeof(o) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof _Symbol && "symbol" == typeof _Symbol$iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof _Symbol && o.constructor === _Symbol && o !== _Symbol.prototype ? "symbol" : typeof o;
  }, _typeof(o);
}