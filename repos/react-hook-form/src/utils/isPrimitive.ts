import type { Primitive } from '../types';

import isNullOrUndefined from './isNullOrUndefined';
import { isObjectType } from './isObject';

export default (value: unknown): value is Primitive =>
  isNullOrUndefined(value) || !isObjectType(value);
