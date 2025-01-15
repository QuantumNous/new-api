var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
function _toSetter(t, e, n) {
  e || (e = []);
  var r = e.length++;
  return _Object$defineProperty({}, "_", {
    set: function set(o) {
      e[r] = o, t.apply(n, e);
    }
  });
}
module.exports = _toSetter, module.exports.__esModule = true, module.exports["default"] = module.exports;