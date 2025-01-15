var _Symbol = require("core-js-pure/features/symbol/index.js");
var _getIteratorMethod = require("core-js-pure/features/get-iterator-method.js");
var _pushInstanceProperty = require("core-js-pure/features/instance/push.js");
function _iterableToArrayLimitLoose(e, r) {
  var t = e && ("undefined" != typeof _Symbol && _getIteratorMethod(e) || e["@@iterator"]);
  if (null != t) {
    var o,
      l = [];
    for (t = t.call(e); e.length < r && !(o = t.next()).done;) _pushInstanceProperty(l).call(l, o.value);
    return l;
  }
}
module.exports = _iterableToArrayLimitLoose, module.exports.__esModule = true, module.exports["default"] = module.exports;