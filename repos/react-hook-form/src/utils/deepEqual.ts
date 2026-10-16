import isDateObject from './isDateObject';
import isObject from './isObject';
import isPlainObject from './isPlainObject';
import isPrimitive from './isPrimitive';

const isEmptyObjectWithCustomPrototype = (object: object, keys: string[]) =>
  keys.length === 0 && !Array.isArray(object) && !isPlainObject(object);

export default function deepEqual(
  object1: any,
  object2: any,
  visited = new WeakMap<object, WeakSet<object>>(),
) {
  if (object1 === object2) {
    return true;
  }

  if (isPrimitive(object1) || isPrimitive(object2)) {
    return Object.is(object1, object2);
  }

  if (isDateObject(object1) && isDateObject(object2)) {
    return Object.is(object1.getTime(), object2.getTime());
  }

  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  if (
    isEmptyObjectWithCustomPrototype(object1, keys1) ||
    isEmptyObjectWithCustomPrototype(object2, keys2)
  ) {
    return Object.is(object1, object2);
  }

  if (!keys1.length && Array.isArray(object1) !== Array.isArray(object2)) {
    return false;
  }

  const visitedPairs = visited.get(object1);

  if (visitedPairs && visitedPairs.has(object2)) {
    return true;
  }

  if (visitedPairs) {
    visitedPairs.add(object2);
  } else {
    const ws = new WeakSet();
    ws.add(object2);
    visited.set(object1, ws);
  }

  for (const key of keys1) {
    const val1 = object1[key];

    if (!(key in object2)) {
      return false;
    }

    if (key !== 'ref') {
      const val2 = object2[key];

      if (
        (isDateObject(val1) && isDateObject(val2)) ||
        ((isObject(val1) || Array.isArray(val1)) &&
          (isObject(val2) || Array.isArray(val2)))
          ? !deepEqual(val1, val2, visited)
          : !Object.is(val1, val2)
      ) {
        return false;
      }
    }
  }

  return true;
}
