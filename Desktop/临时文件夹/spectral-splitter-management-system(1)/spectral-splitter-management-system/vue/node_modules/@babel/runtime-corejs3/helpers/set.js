var _Reflect$set = require("core-js-pure/features/reflect/set.js");
var _Object$getOwnPropertyDescriptor = require("core-js-pure/features/object/get-own-property-descriptor.js");
var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
var superPropBase = require("./superPropBase.js");
var defineProperty = require("./defineProperty.js");
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
function _set(target, property, value, receiver, isStrict) {
  var s = set(target, property, value, receiver || target);
  if (!s && isStrict) {
    throw new TypeError('failed to set property');
  }
  return value;
}
module.exports = _set, module.exports.__esModule = true, module.exports["default"] = module.exports;