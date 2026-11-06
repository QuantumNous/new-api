import type {
  ValidationRule,
  ValidationValue,
  ValidationValueMessage,
} from '../types';
import isObject from '../utils/isObject';
import isRegex from '../utils/isRegex';
import isUndefined from '../utils/isUndefined';

export default <T extends ValidationValue>(
  rule?: ValidationRule<T> | ValidationValueMessage<T>,
) =>
  isUndefined(rule)
    ? rule
    : isRegex(rule)
      ? rule.source
      : isObject(rule)
        ? isRegex(rule.value)
          ? rule.value.source
          : rule.value
        : rule;
