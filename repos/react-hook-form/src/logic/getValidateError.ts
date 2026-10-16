import type { FieldError, Ref, ValidateResult } from '../types';
import isBoolean from '../utils/isBoolean';
import isString from '../utils/isString';

export default function getValidateError(
  result: ValidateResult,
  ref: Ref,
  type = 'validate',
): FieldError | void {
  if (
    isString(result) ||
    (Array.isArray(result) && result.every(isString)) ||
    (isBoolean(result) && !result)
  ) {
    return {
      type,
      message: isString(result) ? result : '',
      ref,
    };
  }
}
