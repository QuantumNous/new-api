import _Reflect$construct from "core-js-pure/features/reflect/construct.js";
import _pushInstanceProperty from "core-js-pure/features/instance/push.js";
import _bindInstanceProperty from "core-js-pure/features/instance/bind.js";
import setPrototypeOf from "./setPrototypeOf.js";
import isNativeReflectConstruct from "./isNativeReflectConstruct.js";
export default function _construct(t, e, r) {
  if (isNativeReflectConstruct()) return _Reflect$construct.apply(null, arguments);
  var o = [null];
  _pushInstanceProperty(o).apply(o, e);
  var p = new (_bindInstanceProperty(t).apply(t, o))();
  return r && setPrototypeOf(p, r.prototype), p;
}