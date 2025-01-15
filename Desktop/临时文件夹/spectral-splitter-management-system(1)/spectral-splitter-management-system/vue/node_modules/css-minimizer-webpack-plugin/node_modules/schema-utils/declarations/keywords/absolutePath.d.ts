export default addAbsolutePathKeyword;
export type Ajv = import("ajv").default;
export type SchemaValidateFunction = import("ajv").SchemaValidateFunction;
export type AnySchemaObject = import("ajv").AnySchemaObject;
export type SchemaUtilErrorObject = import("../validate").SchemaUtilErrorObject;
/**
 *
 * @param {Ajv} ajv
 * @returns {Ajv}
 */
declare function addAbsolutePathKeyword(ajv: Ajv): Ajv;
