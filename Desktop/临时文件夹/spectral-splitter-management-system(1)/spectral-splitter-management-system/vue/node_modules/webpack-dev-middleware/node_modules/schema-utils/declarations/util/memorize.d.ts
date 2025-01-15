export default memoize;
/**
 * @template T
 * @param fn {(function(): any) | undefined}
 * @returns {function(): T}
 */
declare function memoize<T>(fn: (() => any) | undefined): () => T;
