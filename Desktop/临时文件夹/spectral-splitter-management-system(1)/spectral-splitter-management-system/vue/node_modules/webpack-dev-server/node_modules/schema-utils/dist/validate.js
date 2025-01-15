"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "ValidationError", {
  enumerable: true,
  get: function () {
    return _ValidationError.default;
  }
});
exports.disableValidation = disableValidation;
exports.enableValidation = enableValidation;
exports.needValidate = needValidate;
exports.validate = validate;
var _ValidationError = _interopRequireDefault(require("./ValidationError"));
var _memorize = _interopRequireDefault(require("./util/memorize"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const getAjv = (0, _memorize.default)(() => {
  // Use CommonJS require for ajv libs so TypeScript consumers aren't locked into esModuleInterop (see #110).
  // eslint-disable-next-line global-require
  const Ajv = require("ajv").default;
  // eslint-disable-next-line global-require
  const ajvKeywords = require("ajv-keywords").default;
  // eslint-disable-next-line global-require
  const addFormats = require("ajv-formats").default;

  /**
   * @type {Ajv}
   */
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    verbose: true,
    $data: true
  });
  ajvKeywords(ajv, ["instanceof", "patternRequired"]);
  addFormats(ajv, {
    keywords: true
  });

  // Custom keywords
  // eslint-disable-next-line global-require
  const addAbsolutePathKeyword = require("./keywords/absolutePath").default;
  addAbsolutePathKeyword(ajv);
  const addUndefinedAsNullKeyword =
  // eslint-disable-next-line global-require
  require("./keywords/undefinedAsNull").default;
  addUndefinedAsNullKeyword(ajv);
  return ajv;
});

/** @typedef {import("json-schema").JSONSchema4} JSONSchema4 */
/** @typedef {import("json-schema").JSONSchema6} JSONSchema6 */
/** @typedef {import("json-schema").JSONSchema7} JSONSchema7 */
/** @typedef {import("ajv").ErrorObject} ErrorObject */

/**
 * @typedef {Object} Extend
 * @property {string=} formatMinimum
 * @property {string=} formatMaximum
 * @property {string=} formatExclusiveMinimum
 * @property {string=} formatExclusiveMaximum
 * @property {string=} link
 * @property {boolean=} undefinedAsNull
 */

/** @typedef {(JSONSchema4 | JSONSchema6 | JSONSchema7) & Extend} Schema */

/** @typedef {ErrorObject & { children?: Array<ErrorObject> }} SchemaUtilErrorObject */

/**
 * @callback PostFormatter
 * @param {string} formattedError
 * @param {SchemaUtilErrorObject} error
 * @returns {string}
 */

/**
 * @typedef {Object} ValidationErrorConfiguration
 * @property {string=} name
 * @property {string=} baseDataPath
 * @property {PostFormatter=} postFormatter
 */

/**
 * @param {SchemaUtilErrorObject} error
 * @param {number} idx
 * @returns {SchemaUtilErrorObject}
 */
function applyPrefix(error, idx) {
  // eslint-disable-next-line no-param-reassign
  error.instancePath = `[${idx}]${error.instancePath}`;
  if (error.children) {
    error.children.forEach(err => applyPrefix(err, idx));
  }
  return error;
}
let skipValidation = false;

// We use `process.env.SKIP_VALIDATION` because you can have multiple `schema-utils` with different version,
// so we want to disable it globally, `process.env` doesn't supported by browsers, so we have the local `skipValidation` variables

// Enable validation
function enableValidation() {
  skipValidation = false;

  // Disable validation for any versions
  if (process && process.env) {
    process.env.SKIP_VALIDATION = "n";
  }
}

// Disable validation
function disableValidation() {
  skipValidation = true;
  if (process && process.env) {
    process.env.SKIP_VALIDATION = "y";
  }
}

// Check if we need to confirm
function needValidate() {
  if (skipValidation) {
    return false;
  }
  if (process && process.env && process.env.SKIP_VALIDATION) {
    const value = process.env.SKIP_VALIDATION.trim();
    if (/^(?:y|yes|true|1|on)$/i.test(value)) {
      return false;
    }
    if (/^(?:n|no|false|0|off)$/i.test(value)) {
      return true;
    }
  }
  return true;
}

/**
 * @param {Schema} schema
 * @param {Array<object> | object} options
 * @param {ValidationErrorConfiguration=} configuration
 * @returns {void}
 */
function validate(schema, options, configuration) {
  if (!needValidate()) {
    return;
  }
  let errors = [];
  if (Array.isArray(options)) {
    for (let i = 0; i <= options.length - 1; i++) {
      errors.push(...validateObject(schema, options[i]).map(err => applyPrefix(err, i)));
    }
  } else {
    errors = validateObject(schema, options);
  }
  if (errors.length > 0) {
    throw new _ValidationError.default(errors, schema, configuration);
  }
}

/**
 * @param {Schema} schema
 * @param {Array<object> | object} options
 * @returns {Array<SchemaUtilErrorObject>}
 */
function validateObject(schema, options) {
  // Not need to cache, because `ajv@8` has built-in cache
  const compiledSchema = getAjv().compile(schema);
  const valid = compiledSchema(options);
  if (valid) return [];
  return compiledSchema.errors ? filterErrors(compiledSchema.errors) : [];
}

/**
 * @param {Array<ErrorObject>} errors
 * @returns {Array<SchemaUtilErrorObject>}
 */
function filterErrors(errors) {
  /** @type {Array<SchemaUtilErrorObject>} */
  let newErrors = [];
  for (const error of /** @type {Array<SchemaUtilErrorObject>} */errors) {
    const {
      instancePath
    } = error;
    /** @type {Array<SchemaUtilErrorObject>} */
    let children = [];
    newErrors = newErrors.filter(oldError => {
      if (oldError.instancePath.includes(instancePath)) {
        if (oldError.children) {
          children = children.concat(oldError.children.slice(0));
        }

        // eslint-disable-next-line no-undefined, no-param-reassign
        oldError.children = undefined;
        children.push(oldError);
        return false;
      }
      return true;
    });
    if (children.length) {
      error.children = children;
    }
    newErrors.push(error);
  }
  return newErrors;
}