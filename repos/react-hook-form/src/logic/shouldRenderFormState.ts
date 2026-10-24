import { VALIDATION_MODE } from '../constants';
import type {
  FieldValues,
  FormState,
  InternalFieldName,
  ReadFormState,
} from '../types';

export default <T extends FieldValues, K extends ReadFormState>(
  formStateData: Partial<FormState<T>> & {
    name?: InternalFieldName;
    values?: T;
  },
  _proxyFormState: K,
  updateFormState: (formState: Partial<FormState<T>>) => void,
  isRoot?: boolean,
) => {
  updateFormState(formStateData);
  const { name, ...formState } = formStateData;
  const keys = Object.keys(formState);

  return (
    !keys.length ||
    (isRoot && keys.length >= Object.keys(_proxyFormState).length) ||
    keys.find(
      (key) =>
        _proxyFormState[key as keyof ReadFormState] ===
        (!isRoot || VALIDATION_MODE.all),
    )
  );
};
