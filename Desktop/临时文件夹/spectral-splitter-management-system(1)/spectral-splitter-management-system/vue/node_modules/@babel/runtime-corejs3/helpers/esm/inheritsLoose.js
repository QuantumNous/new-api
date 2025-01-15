import _Object$create from "core-js-pure/features/object/create.js";
import setPrototypeOf from "./setPrototypeOf.js";
export default function _inheritsLoose(subClass, superClass) {
  subClass.prototype = _Object$create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  setPrototypeOf(subClass, superClass);
}