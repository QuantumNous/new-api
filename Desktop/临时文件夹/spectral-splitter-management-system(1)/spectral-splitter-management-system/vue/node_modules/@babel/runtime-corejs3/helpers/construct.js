var _Reflect$construct = require("core-js-pure/features/reflect/construct.js");
var _pushInstanceProperty = require("core-js-pure/features/instance/push.js");
var _bindInstanceProperty = require("core-js-pure/features/instance/bind.js");
var setPrototypeOf = require("./setPrototypeOf.js");
var isNativeReflectConstruct = require("./isNativeReflectConstruct.js");
function _construct(t, e, r) {
  if (isNativeReflectConstruct()) return _Reflect$construct.apply(null, arguments);
  var o = [null];
  _pushInstanceProperty(o).apply(o, e);
  var p = new (_bindInstanceProperty(t).apply(t, o))();
  return r && setPrototypeOf(p, r.prototype), p;
}
module.exports = _construct, module.exports.__esModule = true, module.exports["default"] = module.exports;