import _Object$create from "core-js-pure/features/object/create.js";
import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
import setPrototypeOf from "./setPrototypeOf.js";
export default function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }
  subClass.prototype = _Object$create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  _Object$defineProperty(subClass, "prototype", {
    writable: false
  });
  if (superClass) setPrototypeOf(subClass, superClass);
}