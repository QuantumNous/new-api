var _Symbol$asyncDispose = require("core-js-pure/features/symbol/async-dispose.js");
var _Symbol$for = require("core-js-pure/features/symbol/for.js");
var _Symbol$dispose = require("core-js-pure/features/symbol/dispose.js");
var _pushInstanceProperty = require("core-js-pure/features/instance/push.js");
function _using(o, n, e) {
  if (null == n) return n;
  if (Object(n) !== n) throw new TypeError("using declarations can only be used with objects, functions, null, or undefined.");
  if (e) var r = n[_Symbol$asyncDispose || _Symbol$for("Symbol.asyncDispose")];
  if (null == r && (r = n[_Symbol$dispose || _Symbol$for("Symbol.dispose")]), "function" != typeof r) throw new TypeError("Property [Symbol.dispose] is not a function.");
  return _pushInstanceProperty(o).call(o, {
    v: n,
    d: r,
    a: e
  }), n;
}
module.exports = _using, module.exports.__esModule = true, module.exports["default"] = module.exports;