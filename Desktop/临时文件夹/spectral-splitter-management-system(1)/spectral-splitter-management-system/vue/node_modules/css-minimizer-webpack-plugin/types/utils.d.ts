export type Task<T> = () => Promise<T>;
export type Input = import("./index.js").Input;
export type RawSourceMap = import("source-map").RawSourceMap;
export type SourceMapGenerator = import("source-map").SourceMapGenerator;
export type MinimizedResult = import("./index.js").MinimizedResult;
export type CustomOptions = import("./index.js").CustomOptions;
export type ProcessOptions = import("postcss").ProcessOptions;
export type Postcss = import("postcss").Postcss;
/**
 * @template T
 * @typedef {() => Promise<T>} Task
 */
/**
 * Run tasks with limited concurency.
 * @template T
 * @param {number} limit - Limit of tasks that run at once.
 * @param {Task<T>[]} tasks - List of tasks to run.
 * @returns {Promise<T[]>} A promise that fulfills to an array of the results
 */
export function throttleAll<T>(limit: number, tasks: Task<T>[]): Promise<T[]>;
/**
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {CustomOptions} minimizerOptions
 * @return {Promise<MinimizedResult>}
 */
export function cssnanoMinify(
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions
): Promise<MinimizedResult>;
/**
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {CustomOptions} minimizerOptions
 * @return {Promise<MinimizedResult>}
 */
export function cssoMinify(
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minimizerOptions: CustomOptions
): Promise<MinimizedResult>;
/**
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {CustomOptions} minimizerOptions
 * @return {Promise<MinimizedResult>}
 */
export function cleanCssMinify(
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minimizerOptions: CustomOptions
): Promise<MinimizedResult>;
/**
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {CustomOptions} minimizerOptions
 * @return {Promise<MinimizedResult>}
 */
export function esbuildMinify(
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minimizerOptions: CustomOptions
): Promise<MinimizedResult>;
/**
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {CustomOptions} minimizerOptions
 * @return {Promise<MinimizedResult>}
 */
export function parcelCssMinify(
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minimizerOptions: CustomOptions
): Promise<MinimizedResult>;
