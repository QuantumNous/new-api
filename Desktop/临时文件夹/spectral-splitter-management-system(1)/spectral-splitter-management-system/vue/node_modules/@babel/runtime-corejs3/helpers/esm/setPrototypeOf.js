import _Object$setPrototypeOf from "core-js-pure/features/object/set-prototype-of.js";
import _bindInstanceProperty from "core-js-pure/features/instance/bind.js";
export default function _setPrototypeOf(o, p) {
  var _context;
  _setPrototypeOf = _Object$setPrototypeOf ? _bindInstanceProperty(_context = _Object$setPrototypeOf).call(_context) : function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };
  return _setPrototypeOf(o, p);
}