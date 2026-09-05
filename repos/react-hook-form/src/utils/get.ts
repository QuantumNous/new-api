import { PROTOTYPE_KEYWORDS } from '../constants';

import isKey from './isKey';
import isNullOrUndefined from './isNullOrUndefined';
import isObject from './isObject';
import isUndefined from './isUndefined';
import stringToPath from './stringToPath';

export default <T>(
  object: T,
  path?: string | null,
  defaultValue?: unknown,
): any => {
  if (!path || !isObject(object)) {
    return defaultValue;
  }

  const paths = isKey(path) ? [path] : stringToPath(path);
  if (paths.some((key) => PROTOTYPE_KEYWORDS.includes(key))) {
    return defaultValue;
  }

  const result = paths.reduce<any>((result, key) => {
    return isNullOrUndefined(result) ? undefined : result[key];
  }, object);

  return isUndefined(result) || result === object
    ? isUndefined(object[path as keyof T])
      ? defaultValue
      : object[path as keyof T]
    : result;
};
