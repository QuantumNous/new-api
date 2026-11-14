import type { FieldError, FieldErrors, FieldValues } from '../types';
import get from '../utils/get';
import isKey from '../utils/isKey';

export default function schemaErrorLookup<T extends FieldValues = FieldValues>(
  errors: FieldErrors<T>,
  _fields: FieldValues,
  name: string,
): {
  error?: FieldError;
  name: string;
} {
  const error = get(errors, name);

  if (error || isKey(name)) {
    return {
      error,
      name,
    };
  }

  const names = name.split('.');

  while (names.length) {
    const fieldName = names.join('.');
    const field = get(_fields, fieldName);
    const foundError = get(errors, fieldName);

    if (field && !Array.isArray(field) && name !== fieldName) {
      return { name };
    }

    if (foundError && foundError.type) {
      return {
        name: fieldName,
        error: foundError,
      };
    }

    if (foundError && foundError.root && foundError.root.type) {
      return {
        name: `${fieldName}.root`,
        error: foundError.root,
      };
    }

    names.pop();
  }

  return {
    name,
  };
}
