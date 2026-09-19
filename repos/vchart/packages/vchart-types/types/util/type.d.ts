import { isObject, isFunction, isArray, isString, isNumber, isRegExp, isBoolean, isDate, isUndefined, isNull, isNil, isValid, isArrayLike, isValidNumber, isPlainObject } from '@visactor/vutils';
import type { IDataDomainSpec } from '../typings';
export { isObject, isFunction, isArray, isString, isNumber, isRegExp, isBoolean, isDate, isUndefined, isNull, isNil, isValid, isArrayLike, isValidNumber, isPlainObject };
export declare function couldBeValidNumber(v: any): boolean;
export declare function toValidNumber(v: any): number;
export declare function isNumeric(value: string): boolean;
export declare function isDataDomainSpec(domain: any): domain is IDataDomainSpec[];
export declare function isClass(obj: any): boolean;
