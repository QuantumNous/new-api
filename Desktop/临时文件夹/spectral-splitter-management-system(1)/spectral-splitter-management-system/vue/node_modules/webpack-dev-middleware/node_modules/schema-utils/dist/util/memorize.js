"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @template T
 * @param fn {(function(): any) | undefined}
 * @returns {function(): T}
 */
const memoize = fn => {
  let cache = false;
  /** @type {T} */
  let result;
  return () => {
    if (cache) {
      return result;
    }
    result = /** @type {function(): any} */fn();
    cache = true;
    // Allow to clean up memory for fn
    // and all dependent resources
    // eslint-disable-next-line no-undefined, no-param-reassign
    fn = undefined;
    return result;
  };
};
var _default = memoize;
exports.default = _default;