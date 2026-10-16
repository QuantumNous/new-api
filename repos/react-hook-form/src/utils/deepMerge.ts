import isObject from './isObject';
import isPrimitive from './isPrimitive';

export default function deepMerge<
  T extends Record<keyof T, any>,
  U extends Record<keyof U, any>,
>(target: T, source: U): T & U {
  if (isPrimitive(target) || isPrimitive(source)) {
    return source;
  }

  for (const key in source) {
    const targetValue = target[key];
    const sourceValue = source[key];

    try {
      target[key] =
        (isObject(targetValue) && isObject(sourceValue)) ||
        (Array.isArray(targetValue) && Array.isArray(sourceValue))
          ? deepMerge(targetValue, sourceValue)
          : sourceValue;
    } catch {}
  }

  return target;
}
