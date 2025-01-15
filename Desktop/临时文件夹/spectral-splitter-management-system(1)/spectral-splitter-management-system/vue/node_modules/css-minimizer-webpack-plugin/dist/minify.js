"use strict";

/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */

/** @typedef {import("source-map").RawSourceMap} RawSourceMap */

/** @typedef {import("./index.js").InternalResult} InternalResult */

/**
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options
 * @returns {Promise<InternalResult>}
 */
const minify = async options => {
  const minifyFns = Array.isArray(options.minimizer.implementation) ? options.minimizer.implementation : [options.minimizer.implementation];
  /** @type {InternalResult} */

  const result = {
    outputs: [],
    warnings: [],
    errors: []
  };
  let needSourceMap = false;

  for (let i = 0; i <= minifyFns.length - 1; i++) {
    const minifyFn = minifyFns[i];
    const minifyOptions = Array.isArray(options.minimizer.options) ? options.minimizer.options[i] : options.minimizer.options;
    const prevResult = result.outputs.length > 0 ? result.outputs[result.outputs.length - 1] : {
      code: options.input,
      map: options.inputSourceMap
    };
    const {
      code,
      map
    } = prevResult; // eslint-disable-next-line no-await-in-loop

    const minifyResult = await minifyFn({
      [options.name]: code
    }, map, minifyOptions);

    if (typeof minifyResult.code !== "string") {
      throw new Error("minimizer function doesn't return the 'code' property or result is not a string value");
    }

    if (minifyResult.map) {
      needSourceMap = true;
    }

    if (minifyResult.errors) {
      result.errors = result.errors.concat(minifyResult.errors);
    }

    if (minifyResult.warnings) {
      result.warnings = result.warnings.concat(minifyResult.warnings);
    }

    result.outputs.push({
      code: minifyResult.code,
      map: minifyResult.map
    });
  }

  if (!needSourceMap) {
    result.outputs = [result.outputs[result.outputs.length - 1]];
  }

  return result;
};
/**
 * @param {string} options
 * @returns {Promise<InternalResult>}
 */


async function transform(options) {
  // 'use strict' => this === undefined (Clean Scope)
  // Safer for possible security issues, albeit not critical at all here
  // eslint-disable-next-line no-new-func, no-param-reassign
  const evaluatedOptions = new Function("exports", "require", "module", "__filename", "__dirname", `'use strict'\nreturn ${options}`)(exports, require, module, __filename, __dirname);
  return minify(evaluatedOptions);
}

module.exports = {
  minify,
  transform
};