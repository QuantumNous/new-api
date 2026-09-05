import type { FieldValues } from '../types';

import isDateObject from './isDateObject';
import { isObjectType } from './isObject';

export const flatten = (obj: FieldValues) => {
  const output: FieldValues = {};

  for (const key of Object.keys(obj)) {
    if (
      isObjectType(obj[key]) &&
      obj[key] !== null &&
      !isDateObject(obj[key])
    ) {
      const nested = flatten(obj[key]);

      for (const nestedKey of Object.keys(nested)) {
        output[`${key}.${nestedKey}`] = nested[nestedKey];
      }
    } else {
      output[key] = obj[key];
    }
  }

  return output;
};
