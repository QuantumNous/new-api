/**
 * A callback function that can be used with `notify`.
 */
export type Callback<EVENT> = (event: EVENT) => PromiseLike<void> | void;
