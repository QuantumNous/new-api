var _Symbol = require("core-js-pure/features/symbol/index.js");
var _Symbol$asyncIterator = require("core-js-pure/features/symbol/async-iterator.js");
var _Symbol$iterator = require("core-js-pure/features/symbol/iterator.js");
var _Promise = require("core-js-pure/features/promise/index.js");
function _asyncIterator(r) {
  var n,
    t,
    o,
    e = 2;
  for ("undefined" != typeof _Symbol && (t = _Symbol$asyncIterator, o = _Symbol$iterator); e--;) {
    if (t && null != (n = r[t])) return n.call(r);
    if (o && null != (n = r[o])) return new AsyncFromSyncIterator(n.call(r));
    t = "@@asyncIterator", o = "@@iterator";
  }
  throw new TypeError("Object is not async iterable");
}
function AsyncFromSyncIterator(r) {
  function AsyncFromSyncIteratorContinuation(r) {
    if (Object(r) !== r) return _Promise.reject(new TypeError(r + " is not an object."));
    var n = r.done;
    return _Promise.resolve(r.value).then(function (r) {
      return {
        value: r,
        done: n
      };
    });
  }
  return AsyncFromSyncIterator = function AsyncFromSyncIterator(r) {
    this.s = r, this.n = r.next;
  }, AsyncFromSyncIterator.prototype = {
    s: null,
    n: null,
    next: function next() {
      return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments));
    },
    "return": function _return(r) {
      var n = this.s["return"];
      return void 0 === n ? _Promise.resolve({
        value: r,
        done: !0
      }) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments));
    },
    "throw": function _throw(r) {
      var n = this.s["return"];
      return void 0 === n ? _Promise.reject(r) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments));
    }
  }, new AsyncFromSyncIterator(r);
}
module.exports = _asyncIterator, module.exports.__esModule = true, module.exports["default"] = module.exports;