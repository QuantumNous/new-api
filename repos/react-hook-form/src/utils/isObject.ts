import isDateObject from './isDateObject';
import isNullOrUndefined from './isNullOrUndefined';

export const isObjectType = (value: unknown): value is object =>
  typeof value === 'object';

export default <T extends object>(value: unknown): value is T =>
  !isNullOrUndefined(value) &&
  !Array.isArray(value) &&
  isObjectType(value) &&
  !isDateObject(value);
