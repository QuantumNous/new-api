"use strict";

const path = require("path");

// Based on https://github.com/webpack/webpack/blob/master/lib/cli.js
// Please do not modify it

/** @typedef {"unknown-argument" | "unexpected-non-array-in-path" | "unexpected-non-object-in-path" | "multiple-values-unexpected" | "invalid-value"} ProblemType */

/**
 * @typedef {Object} Problem
 * @property {ProblemType} type
 * @property {string} path
 * @property {string} argument
 * @property {any=} value
 * @property {number=} index
 * @property {string=} expected
 */

/**
 * @typedef {Object} LocalProblem
 * @property {ProblemType} type
 * @property {string} path
 * @property {string=} expected
 */

/**
 * @typedef {Object} ArgumentConfig
 * @property {string} description
 * @property {string} path
 * @property {boolean} multiple
 * @property {"enum"|"string"|"path"|"number"|"boolean"|"RegExp"|"reset"} type
 * @property {any[]=} values
 */

/**
 * @typedef {Object} Argument
 * @property {string} description
 * @property {"string"|"number"|"boolean"} simpleType
 * @property {boolean} multiple
 * @property {ArgumentConfig[]} configs
 */

const cliAddedItems = new WeakMap();

/**
 * @param {any} config configuration
 * @param {string} schemaPath path in the config
 * @param {number | undefined} index index of value when multiple values are provided, otherwise undefined
 * @returns {{ problem?: LocalProblem, object?: any, property?: string | number, value?: any }} problem or object with property and value
 */
const getObjectAndProperty = (config, schemaPath, index = 0) => {
  if (!schemaPath) {
    return { value: config };
  }

  const parts = schemaPath.split(".");
  const property = parts.pop();
  let current = config;
  let i = 0;

  for (const part of parts) {
    const isArray = part.endsWith("[]");
    const name = isArray ? part.slice(0, -2) : part;
    let value = current[name];

    if (isArray) {
      // eslint-disable-next-line no-undefined
      if (value === undefined) {
        value = {};
        current[name] = [...Array.from({ length: index }), value];
        cliAddedItems.set(current[name], index + 1);
      } else if (!Array.isArray(value)) {
        return {
          problem: {
            type: "unexpected-non-array-in-path",
            path: parts.slice(0, i).join("."),
          },
        };
      } else {
        let addedItems = cliAddedItems.get(value) || 0;

        while (addedItems <= index) {
          // eslint-disable-next-line no-undefined
          value.push(undefined);
          // eslint-disable-next-line no-plusplus
          addedItems++;
        }

        cliAddedItems.set(value, addedItems);

        const x = value.length - addedItems + index;

        // eslint-disable-next-line no-undefined
        if (value[x] === undefined) {
          value[x] = {};
        } else if (value[x] === null || typeof value[x] !== "object") {
          return {
            problem: {
              type: "unexpected-non-object-in-path",
              path: parts.slice(0, i).join("."),
            },
          };
        }

        value = value[x];
      }
      // eslint-disable-next-line no-undefined
    } else if (value === undefined) {
      // eslint-disable-next-line no-multi-assign
      value = current[name] = {};
    } else if (value === null || typeof value !== "object") {
      return {
        problem: {
          type: "unexpected-non-object-in-path",
          path: parts.slice(0, i).join("."),
        },
      };
    }

    current = value;
    // eslint-disable-next-line no-plusplus
    i++;
  }

  const value = current[/** @type {string} */ (property)];

  if (/** @type {string} */ (property).endsWith("[]")) {
    const name = /** @type {string} */ (property).slice(0, -2);
    // eslint-disable-next-line no-shadow
    const value = current[name];

    // eslint-disable-next-line no-undefined
    if (value === undefined) {
      // eslint-disable-next-line no-undefined
      current[name] = [...Array.from({ length: index }), undefined];
      cliAddedItems.set(current[name], index + 1);

      // eslint-disable-next-line no-undefined
      return { object: current[name], property: index, value: undefined };
    } else if (!Array.isArray(value)) {
      // eslint-disable-next-line no-undefined
      current[name] = [value, ...Array.from({ length: index }), undefined];
      cliAddedItems.set(current[name], index + 1);

      // eslint-disable-next-line no-undefined
      return { object: current[name], property: index + 1, value: undefined };
    }

    let addedItems = cliAddedItems.get(value) || 0;

    while (addedItems <= index) {
      // eslint-disable-next-line no-undefined
      value.push(undefined);
      // eslint-disable-next-line no-plusplus
      addedItems++;
    }

    cliAddedItems.set(value, addedItems);

    const x = value.length - addedItems + index;

    // eslint-disable-next-line no-undefined
    if (value[x] === undefined) {
      value[x] = {};
    } else if (value[x] === null || typeof value[x] !== "object") {
      return {
        problem: {
          type: "unexpected-non-object-in-path",
          path: schemaPath,
        },
      };
    }

    return {
      object: value,
      property: x,
      value: value[x],
    };
  }

  return { object: current, property, value };
};

/**
 * @param {ArgumentConfig} argConfig processing instructions
 * @param {any} value the value
 * @returns {any | undefined} parsed value
 */
const parseValueForArgumentConfig = (argConfig, value) => {
  // eslint-disable-next-line default-case
  switch (argConfig.type) {
    case "string":
      if (typeof value === "string") {
        return value;
      }
      break;
    case "path":
      if (typeof value === "string") {
        return path.resolve(value);
      }
      break;
    case "number":
      if (typeof value === "number") {
        return value;
      }

      if (typeof value === "string" && /^[+-]?\d*(\.\d*)[eE]\d+$/) {
        const n = +value;
        if (!isNaN(n)) return n;
      }

      break;
    case "boolean":
      if (typeof value === "boolean") {
        return value;
      }

      if (value === "true") {
        return true;
      }

      if (value === "false") {
        return false;
      }

      break;
    case "RegExp":
      if (value instanceof RegExp) {
        return value;
      }

      if (typeof value === "string") {
        // cspell:word yugi
        const match = /^\/(.*)\/([yugi]*)$/.exec(value);

        if (match && !/[^\\]\//.test(match[1])) {
          return new RegExp(match[1], match[2]);
        }
      }

      break;
    case "enum":
      if (/** @type {any[]} */ (argConfig.values).includes(value)) {
        return value;
      }

      for (const item of /** @type {any[]} */ (argConfig.values)) {
        if (`${item}` === value) return item;
      }

      break;
    case "reset":
      if (value === true) {
        return [];
      }

      break;
  }
};

/**
 * @param {ArgumentConfig} argConfig processing instructions
 * @returns {string | undefined} expected message
 */
const getExpectedValue = (argConfig) => {
  switch (argConfig.type) {
    default:
      return argConfig.type;
    case "boolean":
      return "true | false";
    case "RegExp":
      return "regular expression (example: /ab?c*/)";
    case "enum":
      return /** @type {any[]} */ (argConfig.values)
        .map((v) => `${v}`)
        .join(" | ");
    case "reset":
      return "true (will reset the previous value to an empty array)";
  }
};

/**
 * @param {any} config configuration
 * @param {string} schemaPath path in the config
 * @param {any} value parsed value
 * @param {number | undefined} index index of value when multiple values are provided, otherwise undefined
 * @returns {LocalProblem | null} problem or null for success
 */
const setValue = (config, schemaPath, value, index) => {
  const { problem, object, property } = getObjectAndProperty(
    config,
    schemaPath,
    index
  );

  if (problem) {
    return problem;
  }

  object[/** @type {string} */ (property)] = value;

  return null;
};

/**
 * @param {ArgumentConfig} argConfig processing instructions
 * @param {any} config configuration
 * @param {any} value the value
 * @param {number | undefined} index the index if multiple values provided
 * @returns {LocalProblem | null} a problem if any
 */
const processArgumentConfig = (argConfig, config, value, index) => {
  // eslint-disable-next-line no-undefined
  if (index !== undefined && !argConfig.multiple) {
    return {
      type: "multiple-values-unexpected",
      path: argConfig.path,
    };
  }

  const parsed = parseValueForArgumentConfig(argConfig, value);

  // eslint-disable-next-line no-undefined
  if (parsed === undefined) {
    return {
      type: "invalid-value",
      path: argConfig.path,
      expected: getExpectedValue(argConfig),
    };
  }

  const problem = setValue(config, argConfig.path, parsed, index);

  if (problem) {
    return problem;
  }

  return null;
};

/**
 * @param {Record<string, Argument>} args object of arguments
 * @param {any} config configuration
 * @param {Record<string, string | number | boolean | RegExp | (string | number | boolean | RegExp)[]>} values object with values
 * @returns {Problem[] | null} problems or null for success
 */
const processArguments = (args, config, values) => {
  /**
   * @type {Problem[]}
   */
  const problems = [];

  for (const key of Object.keys(values)) {
    const arg = args[key];

    if (!arg) {
      problems.push({
        type: "unknown-argument",
        path: "",
        argument: key,
      });

      // eslint-disable-next-line no-continue
      continue;
    }

    /**
     * @param {any} value
     * @param {number | undefined} i
     */
    const processValue = (value, i) => {
      const currentProblems = [];

      for (const argConfig of arg.configs) {
        const problem = processArgumentConfig(argConfig, config, value, i);

        if (!problem) {
          return;
        }

        currentProblems.push({
          ...problem,
          argument: key,
          value,
          index: i,
        });
      }

      problems.push(...currentProblems);
    };

    const value = values[key];

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        processValue(value[i], i);
      }
    } else {
      // eslint-disable-next-line no-undefined
      processValue(value, undefined);
    }
  }

  if (problems.length === 0) {
    return null;
  }

  return problems;
};

module.exports = processArguments;
