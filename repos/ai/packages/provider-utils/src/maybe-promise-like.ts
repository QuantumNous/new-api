/**
 * A value that can be provided either synchronously or as a promise-like.
 */
export type MaybePromiseLike<T> =
  | T // Raw value
  | PromiseLike<T>; // Promise of value
