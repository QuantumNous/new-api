export default addUndefinedAsNullKeyword;
export type Ajv = import("ajv").default;
export type SchemaValidateFunction = import("ajv").SchemaValidateFunction;
export type AnySchemaObject = import("ajv").AnySchemaObject;
export type ValidateFunction = import("ajv").ValidateFunction;
/** @typedef {import("ajv").default} Ajv */
/** @typedef {import("ajv").SchemaValidateFunction} SchemaValidateFunction */
/** @typedef {import("ajv").AnySchemaObject} AnySchemaObject */
/** @typedef {import("ajv").ValidateFunction} ValidateFunction */
/**
 *
 * @param {Ajv} ajv
 * @returns {Ajv}
 */
declare function addUndefinedAsNullKeyword(ajv: Ajv): Ajv;
