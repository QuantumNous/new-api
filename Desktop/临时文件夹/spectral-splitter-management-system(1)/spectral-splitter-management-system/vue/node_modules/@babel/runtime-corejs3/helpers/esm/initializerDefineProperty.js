import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
export default function _initializerDefineProperty(target, property, descriptor, context) {
  if (!descriptor) return;
  _Object$defineProperty(target, property, {
    enumerable: descriptor.enumerable,
    configurable: descriptor.configurable,
    writable: descriptor.writable,
    value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
  });
}