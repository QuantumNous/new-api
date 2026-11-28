import isObject from './isObject';

export default function extractFormValues<
  T extends object,
  K extends Record<string, unknown>,
>(fieldsState: T, formValues: K) {
  const values: Record<string, unknown> = {};

  for (const key in fieldsState) {
    if (fieldsState.hasOwnProperty(key)) {
      const fieldState = fieldsState[key];
      const fieldValue = formValues[key];

      if (fieldState && isObject(fieldState) && fieldValue) {
        const nestedFieldsState = extractFormValues(
          fieldState,
          fieldValue as K,
        );

        if (isObject(nestedFieldsState)) {
          values[key] = nestedFieldsState;
        }
      } else if (fieldsState[key]) {
        values[key] = fieldValue;
      }
    }
  }

  return values;
}
