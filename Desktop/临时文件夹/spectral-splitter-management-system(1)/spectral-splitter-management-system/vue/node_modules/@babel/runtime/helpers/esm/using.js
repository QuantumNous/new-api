import _typeof from "./typeof.js";
export default function _using(o, e, n) {
  if (null == e) return e;
  if ("object" != _typeof(e)) throw new TypeError("using declarations can only be used with objects, null, or undefined.");
  if (n) var r = e[Symbol.asyncDispose || Symbol["for"]("Symbol.asyncDispose")];
  if (null == r && (r = e[Symbol.dispose || Symbol["for"]("Symbol.dispose")]), "function" != typeof r) throw new TypeError("Property [Symbol.dispose] is not a function.");
  return o.push({
    v: e,
    d: r,
    a: n
  }), e;
}