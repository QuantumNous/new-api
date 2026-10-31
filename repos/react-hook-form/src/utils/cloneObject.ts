import isObject from './isObject';
import isPlainObject from './isPlainObject';
import isWeb from './isWeb';

export default function cloneObject<T>(data: T): T {
  if (data instanceof Date) {
    return new Date(data) as any;
  }

  const isFileListInstance =
    typeof FileList !== 'undefined' && data instanceof FileList;

  if (isWeb && (data instanceof Blob || isFileListInstance)) {
    return data;
  }

  const isArray = Array.isArray(data);

  if (!isArray && !(isObject(data) && isPlainObject(data))) {
    return data;
  }

  const copy = isArray ? [] : Object.create(Object.getPrototypeOf(data));

  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      copy[key] = cloneObject(data[key]);
    }
  }

  return copy;
}
