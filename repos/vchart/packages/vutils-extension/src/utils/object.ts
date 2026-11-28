import { get, isArray, isFunction, isNil, isObject } from '@visactor/vutils';

/**
 * 判断一个 spec 是否包含另一个 spec 片段
 * @param spec 原始 spec
 * @param searchSpec 要匹配的 spec 片段
 */
export const includeSpec = <T = any>(spec: Partial<T>, searchSpec: Partial<T>): boolean => {
  if (spec === searchSpec) {
    return true;
  }
  if (isFunction(spec) || isFunction(searchSpec)) {
    return false;
  }
  if (isArray(spec) && isArray(searchSpec)) {
    return searchSpec.every(searchItem => spec.some(item => includeSpec(item, searchItem)));
  }
  if (isObject(spec) && isObject(searchSpec)) {
    return Object.keys(searchSpec).every(key => includeSpec(spec[key], searchSpec[key]));
  }
  return false;
};

export const setProperty = <T>(target: T, path: Array<string | number>, value: any): T => {
  if (isNil(path)) {
    return target;
  }
  const key = path[0];
  if (isNil(key)) {
    return target;
  }
  if (path.length === 1) {
    target[key] = value;
    return target;
  }
  if (isNil(target[key])) {
    if (typeof path[1] === 'number') {
      target[key] = [];
    } else {
      target[key] = {};
    }
  }
  return setProperty(target[key], path.slice(1), value);
};

export const getProperty = <T>(target: any, path: Array<string | number>, defaultValue?: T): T => {
  if (isNil(path)) {
    return undefined;
  }
  return get(target, path as string[], defaultValue) as T;
};
