import _forEachInstanceProperty from "core-js-pure/features/instance/for-each.js";
import _Object$keys from "core-js-pure/features/object/keys.js";
import _reduceInstanceProperty from "core-js-pure/features/instance/reduce.js";
import _reverseInstanceProperty from "core-js-pure/features/instance/reverse.js";
import _sliceInstanceProperty from "core-js-pure/features/instance/slice.js";
import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
export default function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var _context, _context2, _context3;
  var desc = {};
  _forEachInstanceProperty(_context = _Object$keys(descriptor)).call(_context, function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;
  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }
  desc = _reduceInstanceProperty(_context2 = _reverseInstanceProperty(_context3 = _sliceInstanceProperty(decorators).call(decorators)).call(_context3)).call(_context2, function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);
  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }
  if (desc.initializer === void 0) {
    _Object$defineProperty(target, property, desc);
    desc = null;
  }
  return desc;
}