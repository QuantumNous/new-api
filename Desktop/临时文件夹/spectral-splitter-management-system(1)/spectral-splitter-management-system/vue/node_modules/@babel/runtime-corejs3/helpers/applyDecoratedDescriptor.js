var _forEachInstanceProperty = require("core-js-pure/features/instance/for-each.js");
var _Object$keys = require("core-js-pure/features/object/keys.js");
var _reduceInstanceProperty = require("core-js-pure/features/instance/reduce.js");
var _reverseInstanceProperty = require("core-js-pure/features/instance/reverse.js");
var _sliceInstanceProperty = require("core-js-pure/features/instance/slice.js");
var _Object$defineProperty = require("core-js-pure/features/object/define-property.js");
function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
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
module.exports = _applyDecoratedDescriptor, module.exports.__esModule = true, module.exports["default"] = module.exports;