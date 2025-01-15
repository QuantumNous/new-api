export type MinimizedResult = import("./index.js").MinimizedResult;
export type RawSourceMap = import("source-map").RawSourceMap;
export type InternalResult = import("./index.js").InternalResult;
/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("source-map").RawSourceMap} RawSourceMap */
/** @typedef {import("./index.js").InternalResult} InternalResult */
/**
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options
 * @returns {Promise<InternalResult>}
 */
export function minify<T>(
  options: import("./index.js").InternalOptions<T>
): Promise<InternalResult>;
/**
 * @param {string} options
 * @returns {Promise<InternalResult>}
 */
export function transform(options: string): Promise<InternalResult>;
