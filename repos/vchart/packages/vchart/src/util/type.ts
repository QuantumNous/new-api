import {
  isObject,
  isFunction,
  isArray,
  isString,
  isNumber,
  isRegExp,
  isBoolean,
  isDate,
  isUndefined,
  isNull,
  isNil,
  isValid,
  isArrayLike,
  isValidNumber,
  isPlainObject
} from '@visactor/vutils';
import type { IDataDomainSpec } from '../typings';

export {
  isObject,
  isFunction,
  isArray,
  isString,
  isNumber,
  isRegExp,
  isBoolean,
  isDate,
  isUndefined,
  isNull,
  isNil,
  isValid,
  isArrayLike,
  isValidNumber,
  isPlainObject
};

export function couldBeValidNumber(v: any) {
  if (v === null || v === undefined || v === '') {
    return false;
  }
  if (isNumber(v)) {
    return true;
  }
  // eslint-disable-next-line no-self-compare
  return +v === +v;
}

export function toValidNumber(v: any) {
  if (isValidNumber(v)) {
    return v;
  }
  const value = +v;
  return isValidNumber(value) ? value : 0;
}

/**
 * 检测一段字符串为合法数值
 */
export function isNumeric(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return !isNaN(Number(value)) && !isNaN(parseFloat(value));
}

export function isDataDomainSpec(domain: any): domain is IDataDomainSpec[] {
  if (!domain || domain.length === 0) {
    return false;
  }
  if (isNil(domain[0]) || isNil(domain[0].dataId)) {
    return false;
  }
  return isArray(domain[0].fields);
}

// 可靠的class判定函数
export function isClass(obj: any): boolean {
  return typeof obj === 'function' && /^class\s/.test(obj.toString());
}
