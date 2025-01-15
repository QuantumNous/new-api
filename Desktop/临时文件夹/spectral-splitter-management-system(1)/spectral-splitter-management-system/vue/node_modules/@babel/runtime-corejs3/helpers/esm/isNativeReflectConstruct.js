import _Reflect$construct from "core-js-pure/features/reflect/construct.js";
export default function _isNativeReflectConstruct() {
  try {
    var t = !Boolean.prototype.valueOf.call(_Reflect$construct(Boolean, [], function () {}));
  } catch (t) {}
  return (_isNativeReflectConstruct = function _isNativeReflectConstruct() {
    return !!t;
  })();
}