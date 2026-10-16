import type { FieldRefs } from '../types';
import deepEqual from '../utils/deepEqual';
import isNullOrUndefined from '../utils/isNullOrUndefined';
import isObject from '../utils/isObject';
import isPrimitive from '../utils/isPrimitive';
import isUndefined from '../utils/isUndefined';
import objectHasFunction from '../utils/objectHasFunction';

function isTraversable<T>(value: T): boolean {
  return Array.isArray(value) || (isObject(value) && !objectHasFunction(value));
}

function isRegisteredLeaf(fieldRef: unknown): boolean {
  return !!(fieldRef && '_f' in (fieldRef as object));
}

function isEmptyDirtyContainer(value: Record<string, any>): boolean {
  return Array.isArray(value)
    ? !value.some((item) => !isUndefined(item))
    : !Object.keys(value).length;
}

function clearDirtyField(container: Record<string, any>, key: string) {
  if (Array.isArray(container)) {
    (container as any)[key] = undefined;
  } else {
    delete container[key];
  }
}

function markFieldsDirty<T>(
  data: T,
  fields: Record<string, any> = {},
  fieldRefs?: Record<string, any>,
) {
  for (const key in data) {
    const value = data[key];
    const fieldRef = fieldRefs && fieldRefs[key];

    if (
      isTraversable(value) &&
      (!Array.isArray(value) || !isRegisteredLeaf(fieldRef))
    ) {
      fields[key] = Array.isArray(value) ? [] : {};
      markFieldsDirty(value, fields[key], fieldRef);

      if (isEmptyDirtyContainer(fields[key])) {
        clearDirtyField(fields, key);
      }
    } else if (!isUndefined(value)) {
      fields[key] = true;
    }
  }

  return fields;
}

export default function getDirtyFields<T>(
  data: T,
  formValues: T,
  dirtyFieldsFromValues?: Record<
    Extract<keyof T, string>,
    ReturnType<typeof markFieldsDirty> | boolean
  >,
  fieldRefs?: FieldRefs,
) {
  if (!dirtyFieldsFromValues) {
    dirtyFieldsFromValues = markFieldsDirty(formValues, {}, fieldRefs);
  }

  for (const key in data) {
    const value = data[key];
    const fieldRef = fieldRefs && (fieldRefs as Record<string, any>)[key];

    if (
      isTraversable(value) &&
      (!Array.isArray(value) || !isRegisteredLeaf(fieldRef))
    ) {
      if (isUndefined(formValues) || isPrimitive(dirtyFieldsFromValues[key])) {
        dirtyFieldsFromValues[key] = markFieldsDirty(
          value,
          Array.isArray(value) ? [] : {},
          fieldRef,
        );
      } else {
        getDirtyFields(
          value,
          isNullOrUndefined(formValues) ? {} : formValues[key],
          dirtyFieldsFromValues[key],
          fieldRef,
        );
      }

      if (isEmptyDirtyContainer(dirtyFieldsFromValues[key])) {
        clearDirtyField(dirtyFieldsFromValues, key);
      }
    } else if (deepEqual(value, formValues[key])) {
      clearDirtyField(dirtyFieldsFromValues, key);
    } else {
      dirtyFieldsFromValues[key] = true;
    }
  }

  return dirtyFieldsFromValues;
}
