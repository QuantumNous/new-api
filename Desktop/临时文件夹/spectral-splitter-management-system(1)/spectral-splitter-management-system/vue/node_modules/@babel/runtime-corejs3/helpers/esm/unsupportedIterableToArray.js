import _sliceInstanceProperty from "core-js-pure/features/instance/slice.js";
import _Array$from from "core-js-pure/features/array/from.js";
import arrayLikeToArray from "./arrayLikeToArray.js";
export default function _unsupportedIterableToArray(o, minLen) {
  var _context;
  if (!o) return;
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = _sliceInstanceProperty(_context = Object.prototype.toString.call(o)).call(_context, 8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return _Array$from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
}