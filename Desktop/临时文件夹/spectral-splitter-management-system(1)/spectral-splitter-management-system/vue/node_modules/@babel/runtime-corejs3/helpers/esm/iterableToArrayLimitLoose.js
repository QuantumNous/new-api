import _Symbol from "core-js-pure/features/symbol/index.js";
import _getIteratorMethod from "core-js-pure/features/get-iterator-method.js";
import _pushInstanceProperty from "core-js-pure/features/instance/push.js";
export default function _iterableToArrayLimitLoose(e, r) {
  var t = e && ("undefined" != typeof _Symbol && _getIteratorMethod(e) || e["@@iterator"]);
  if (null != t) {
    var o,
      l = [];
    for (t = t.call(e); e.length < r && !(o = t.next()).done;) _pushInstanceProperty(l).call(l, o.value);
    return l;
  }
}