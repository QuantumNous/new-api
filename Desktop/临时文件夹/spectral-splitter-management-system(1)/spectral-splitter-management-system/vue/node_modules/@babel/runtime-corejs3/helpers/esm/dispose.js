import _SuppressedError from "core-js-pure/features/suppressed-error.js";
import _Object$create from "core-js-pure/features/object/create.js";
import _Promise from "core-js-pure/features/promise/index.js";
function dispose_SuppressedError(r, e) {
  return "undefined" != typeof _SuppressedError ? dispose_SuppressedError = _SuppressedError : (dispose_SuppressedError = function dispose_SuppressedError(r, e) {
    this.suppressed = e, this.error = r, this.stack = Error().stack;
  }, dispose_SuppressedError.prototype = _Object$create(Error.prototype, {
    constructor: {
      value: dispose_SuppressedError,
      writable: !0,
      configurable: !0
    }
  })), new dispose_SuppressedError(r, e);
}
export default function _dispose(r, e, s) {
  function next() {
    for (; r.length > 0;) try {
      var o = r.pop(),
        p = o.d.call(o.v);
      if (o.a) return _Promise.resolve(p).then(next, err);
    } catch (r) {
      return err(r);
    }
    if (s) throw e;
  }
  function err(r) {
    return e = s ? new dispose_SuppressedError(e, r) : r, s = !0, next();
  }
  return next();
}