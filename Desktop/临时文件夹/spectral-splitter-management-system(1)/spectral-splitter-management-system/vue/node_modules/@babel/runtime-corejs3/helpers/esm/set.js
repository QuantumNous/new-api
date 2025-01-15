import _Reflect$set from "core-js-pure/features/reflect/set.js";
import _Object$getOwnPropertyDescriptor from "core-js-pure/features/object/get-own-property-descriptor.js";
import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
import superPropBase from "./superPropBase.js";
import defineProperty from "./defineProperty.js";
function set(target, property, value, receiver) {
  if (typeof Reflect !== "undefined" && _Reflect$set) {
    set = _Reflect$set;
  } else {
    set = function set(target, property, value, receiver) {
      var base = superPropBase(target, property);
      var desc;
      if (base) {
        desc = _Object$getOwnPropertyDescriptor(base, property);
        if (desc.set) {
          desc.set.call(receiver, value);
          return true;
        } else if (!desc.writable) {
          return false;
        }
      }
      desc = _Object$getOwnPropertyDescriptor(receiver, property);
      if (desc) {
        if (!desc.writable) {
          return false;
        }
        desc.value = value;
        _Object$defineProperty(receiver, property, desc);
      } else {
        defineProperty(receiver, property, value);
      }
      return true;
    };
  }
  return set(target, property, value, receiver);
}
export default function _set(target, property, value, receiver, isStrict) {
  var s = set(target, property, value, receiver || target);
  if (!s && isStrict) {
    throw new TypeError('failed to set property');
  }
  return value;
}