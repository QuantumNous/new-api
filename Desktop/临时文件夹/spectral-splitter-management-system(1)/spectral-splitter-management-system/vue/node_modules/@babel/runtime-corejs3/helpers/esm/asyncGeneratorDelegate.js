import _Promise from "core-js-pure/features/promise/index.js";
import _Symbol from "core-js-pure/features/symbol/index.js";
import _Symbol$iterator from "core-js-pure/features/symbol/iterator.js";
import OverloadYield from "./OverloadYield.js";
export default function _asyncGeneratorDelegate(t) {
  var e = {},
    n = !1;
  function pump(e, r) {
    return n = !0, r = new _Promise(function (n) {
      n(t[e](r));
    }), {
      done: !1,
      value: new OverloadYield(r, 1)
    };
  }
  return e["undefined" != typeof _Symbol && _Symbol$iterator || "@@iterator"] = function () {
    return this;
  }, e.next = function (t) {
    return n ? (n = !1, t) : pump("next", t);
  }, "function" == typeof t["throw"] && (e["throw"] = function (t) {
    if (n) throw n = !1, t;
    return pump("throw", t);
  }), "function" == typeof t["return"] && (e["return"] = function (t) {
    return n ? (n = !1, t) : pump("return", t);
  }), e;
}