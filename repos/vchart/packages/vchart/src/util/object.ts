import { get, pick, cloneDeep, isArray } from '@visactor/vutils';

export { get, pick, cloneDeep };

export function field(f: string | string[]) {
  return function (datum: any) {
    let value: any;
    if (!isArray(f)) {
      value = datum?.[f];
    } else {
      value = f.reduce((cur, g) => cur?.[g], datum);
    }
    return value;
  };
}

export function removeUndefined(obj: any, deep = false): void {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (obj[key] === undefined) {
        delete obj[key];
        continue;
      }
      if (deep) {
        removeUndefined(obj[key], deep);
      }
    }
  }
}
