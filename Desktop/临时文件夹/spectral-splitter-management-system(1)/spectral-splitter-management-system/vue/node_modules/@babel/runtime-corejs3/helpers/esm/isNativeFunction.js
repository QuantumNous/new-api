import _indexOfInstanceProperty from "core-js-pure/features/instance/index-of.js";
export default function _isNativeFunction(fn) {
  try {
    var _context;
    return _indexOfInstanceProperty(_context = Function.toString.call(fn)).call(_context, "[native code]") !== -1;
  } catch (e) {
    return typeof fn === "function";
  }
}