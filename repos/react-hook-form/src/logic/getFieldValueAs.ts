import type { Field, NativeFieldValue } from '../types';
import isString from '../utils/isString';
import isUndefined from '../utils/isUndefined';

export default <T extends NativeFieldValue>(
  value: T,
  { valueAsNumber, valueAsDate, setValueAs }: Field['_f'],
) =>
  isUndefined(value)
    ? value
    : valueAsNumber
      ? value === ''
        ? NaN
        : value
          ? +value
          : value
      : valueAsDate && isString(value)
        ? new Date(value)
        : setValueAs
          ? setValueAs(value)
          : value;
