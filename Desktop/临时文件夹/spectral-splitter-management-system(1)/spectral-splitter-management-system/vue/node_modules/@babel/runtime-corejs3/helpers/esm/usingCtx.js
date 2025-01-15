import _SuppressedError from "core-js-pure/features/suppressed-error.js";
import _Symbol$asyncDispose from "core-js-pure/features/symbol/async-dispose.js";
import _Symbol$for from "core-js-pure/features/symbol/for.js";
import _Symbol$dispose from "core-js-pure/features/symbol/dispose.js";
import _pushInstanceProperty from "core-js-pure/features/instance/push.js";
import _bindInstanceProperty from "core-js-pure/features/instance/bind.js";
import _Promise from "core-js-pure/features/promise/index.js";
export default function _usingCtx() {
  var r = "function" == typeof _SuppressedError ? _SuppressedError : function (r, n) {
      var e = Error();
      return e.name = "SuppressedError", e.suppressed = n, e.error = r, e;
    },
    n = {},
    e = [];
  function using(r, n) {
    if (null != n) {
      if (Object(n) !== n) throw new TypeError("using declarations can only be used with objects, functions, null, or undefined.");
      if (r) var o = n[_Symbol$asyncDispose || _Symbol$for("Symbol.asyncDispose")];
      if (null == o && (o = n[_Symbol$dispose || _Symbol$for("Symbol.dispose")]), "function" != typeof o) throw new TypeError("Property [Symbol.dispose] is not a function.");
      _pushInstanceProperty(e).call(e, {
        v: n,
        d: o,
        a: r
      });
    }
    return n;
  }
  return {
    e: n,
    u: _bindInstanceProperty(using).call(using, null, !1),
    a: _bindInstanceProperty(using).call(using, null, !0),
    d: function d() {
      var o = this.e;
      function next() {
        for (; r = e.pop();) try {
          var r,
            t = r.d.call(r.v);
          if (r.a) return _Promise.resolve(t).then(next, err);
        } catch (r) {
          return err(r);
        }
        if (o !== n) throw o;
      }
      function err(e) {
        return o = o !== n ? new r(o, e) : e, next();
      }
      return next();
    }
  };
}