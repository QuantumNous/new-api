import _Object$setPrototypeOf from "core-js-pure/features/object/set-prototype-of.js";
import _bindInstanceProperty from "core-js-pure/features/instance/bind.js";
import _Object$getPrototypeOf from "core-js-pure/features/object/get-prototype-of.js";
export default function _getPrototypeOf(o) {
  var _context;
  _getPrototypeOf = _Object$setPrototypeOf ? _bindInstanceProperty(_context = _Object$getPrototypeOf).call(_context) : function _getPrototypeOf(o) {
    return o.__proto__ || _Object$getPrototypeOf(o);
  };
  return _getPrototypeOf(o);
}