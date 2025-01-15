var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
var _typeof = require("./typeof.js")["default"];
function setFunctionName(e, t, n) {
  "symbol" == _typeof(t) && (t = (t = t.description) ? "[" + t + "]" : "");
  try {
    _Object$defineProperty(e, "name", {
      configurable: !0,
      value: n ? n + " " + t : t
    });
  } catch (e) {}
  return e;
}
module.exports = setFunctionName, module.exports.__esModule = true, module.exports["default"] = module.exports;