// @ts-check
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
'use strict';

/**
 * @type {{[sortmode: string] : (entryPointNames: Array<string>, compilation, htmlWebpackPluginOptions) => Array<string> }}
 * This file contains different sort methods for the entry chunks names
 */
module.exports = {};

/**
 * Performs identity mapping (no-sort).
 * @param  {Array} chunks the chunks to sort
 * @return {Array} The sorted chunks
 */
module.exports.none = chunks => chunks;

/**
 * Sort manually by the chunks
 * @param  {string[]} entryPointNames the chunks to sort
 * @param  {WebpackCompilation} compilation the webpack compilation
 * @param  htmlWebpackPluginOptions the plugin options
 * @return {string[]} The sorted chunks
 */
module.exports.manual = (entryPointNames, compilation, htmlWebpackPluginOptions) => {
  const chunks = htmlWebpackPluginOptions.chunks;
  if (!Array.isArray(chunks)) {
    return entryPointNames;
  }
  // Remove none existing entries from
  // htmlWebpackPluginOptions.chunks
  return chunks.filter((entryPointName) => {
    return compilation.entrypoints.has(entryPointName);
  });
};

/**
 * Defines the default sorter.
 */
module.exports.auto = module.exports.none;
