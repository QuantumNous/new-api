import _Reflect$construct from "core-js-pure/features/reflect/construct.js";
import getPrototypeOf from "./getPrototypeOf.js";
import isNativeReflectConstruct from "./isNativeReflectConstruct.js";
import possibleConstructorReturn from "./possibleConstructorReturn.js";
export default function _createSuper(Derived) {
  var hasNativeReflectConstruct = isNativeReflectConstruct();
  return function _createSuperInternal() {
    var Super = getPrototypeOf(Derived),
      result;
    if (hasNativeReflectConstruct) {
      var NewTarget = getPrototypeOf(this).constructor;
      result = _Reflect$construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return possibleConstructorReturn(this, result);
  };
}