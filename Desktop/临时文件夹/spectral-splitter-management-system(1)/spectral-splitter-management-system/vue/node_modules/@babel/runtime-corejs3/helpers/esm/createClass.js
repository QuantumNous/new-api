import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
import toPropertyKey from "./toPropertyKey.js";
function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    _Object$defineProperty(target, toPropertyKey(descriptor.key), descriptor);
  }
}
export default function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  _Object$defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}