export type Compilation = import("webpack").Compilation;
export type Module = import("webpack").Module;
export type LoaderContext = import("webpack").LoaderContext<any>;
/** @typedef {import("webpack").Compilation} Compilation */
/** @typedef {import("webpack").Module} Module */
/** @typedef {import("webpack").LoaderContext<any>} LoaderContext */
/**
 * @returns {boolean}
 */
export function trueFn(): boolean;
/**
 * @param {Compilation} compilation
 * @param {string | number} id
 * @returns {null | Module}
 */
export function findModuleById(
  compilation: Compilation,
  id: string | number
): null | Module;
/**
 * @param {LoaderContext} loaderContext
 * @param {string | Buffer} code
 * @param {string} filename
 * @returns {object}
 */
export function evalModuleCode(
  loaderContext: LoaderContext,
  code: string | Buffer,
  filename: string
): object;
/**
 * @param {Module} a
 * @param {Module} b
 * @returns {0 | 1 | -1}
 */
export function compareModulesByIdentifier(a: Module, b: Module): 0 | 1 | -1;
export const MODULE_TYPE: "css/mini-extract";
export const AUTO_PUBLIC_PATH: "__mini_css_extract_plugin_public_path_auto__";
export const ABSOLUTE_PUBLIC_PATH: "webpack:///mini-css-extract-plugin/";
export const BASE_URI: "webpack://";
export const SINGLE_DOT_PATH_SEGMENT: "__mini_css_extract_plugin_single_dot_path_segment__";
/**
 * @param {LoaderContext} loaderContext
 * @param {string} request
 * @returns {string}
 */
export function stringifyRequest(
  loaderContext: LoaderContext,
  request: string
): string;
/**
 *
 * @param {string | function} value
 * @returns {string}
 */
export function stringifyLocal(value: string | Function): string;
/**
 * @param {string} filename
 * @param {string} outputPath
 * @param {boolean} enforceRelative
 * @returns {string}
 */
export function getUndoPath(
  filename: string,
  outputPath: string,
  enforceRelative: boolean
): string;
