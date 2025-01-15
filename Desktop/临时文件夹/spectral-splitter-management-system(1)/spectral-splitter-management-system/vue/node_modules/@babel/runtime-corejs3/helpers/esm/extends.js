import _Object$assign from "core-js-pure/features/object/assign.js";
import _bindInstanceProperty from "core-js-pure/features/instance/bind.js";
export default function _extends() {
  var _context;
  _extends = _Object$assign ? _bindInstanceProperty(_context = _Object$assign).call(_context) : function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}