import type {
  CriteriaMode,
  Field,
  FieldName,
  FieldRefs,
  FieldValues,
  InternalFieldName,
} from '../types';
import { get } from '../utils';
import set from '../utils/set';

export default <TFieldValues extends FieldValues>(
  fieldsNames: Set<InternalFieldName> | InternalFieldName[],
  _fields: FieldRefs,
  criteriaMode?: CriteriaMode,
  shouldUseNativeValidation?: boolean | undefined,
) => {
  const fields: Record<InternalFieldName, Field['_f']> = {};

  for (const name of fieldsNames) {
    const field: Field = get(_fields, name);

    field && set(fields, name, field._f);
  }

  return {
    criteriaMode,
    names: [...fieldsNames] as FieldName<TFieldValues>[],
    fields,
    shouldUseNativeValidation,
  };
};
