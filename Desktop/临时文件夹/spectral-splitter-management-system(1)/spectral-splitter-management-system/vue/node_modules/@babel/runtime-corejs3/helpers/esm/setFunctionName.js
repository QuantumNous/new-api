import _typeof from "./typeof.js";
import _Object$defineProperty from "core-js-pure/features/object/define-property.js";
export default function setFunctionName(e, t, n) {
  "symbol" == _typeof(t) && (t = (t = t.description) ? "[" + t + "]" : "");
  try {
    _Object$defineProperty(e, "name", {
      configurable: !0,
      value: n ? n + " " + t : t
    });
  } catch (e) {}
  return e;
}