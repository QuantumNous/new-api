import isEmptyObject from './isEmptyObject';
import isKey from './isKey';
import isNullOrUndefined from './isNullOrUndefined';
import isObject from './isObject';
import isString from './isString';
import isUndefined from './isUndefined';
import stringToPath from './stringToPath';

function baseGet(object: any, updatePath: (string | number)[]) {
  const length = updatePath.slice(0, -1).length;
  let index = 0;

  while (index < length) {
    if (isNullOrUndefined(object)) {
      object = undefined;
      break;
    }
    object = object[updatePath[index]];
    index++;
  }

  return object;
}

function isEmptyArray(obj: unknown[]) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && !isUndefined(obj[key])) {
      return false;
    }
  }
  return true;
}

export default function unset(object: any, path: string | (string | number)[]) {
  if (isString(path) && Object.prototype.hasOwnProperty.call(object, path)) {
    delete object[path];
    return object;
  }

  const paths = Array.isArray(path)
    ? path
    : isKey(path)
      ? [path]
      : stringToPath(path);

  const childObject = paths.length === 1 ? object : baseGet(object, paths);

  const index = paths.length - 1;
  const key = paths[index];

  if (childObject) {
    delete childObject[key];
  }

  if (
    index !== 0 &&
    ((isObject(childObject) && isEmptyObject(childObject)) ||
      (Array.isArray(childObject) && isEmptyArray(childObject)))
  ) {
    unset(object, paths.slice(0, -1));
  }

  return object;
}
