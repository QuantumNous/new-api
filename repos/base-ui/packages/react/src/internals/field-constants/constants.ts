import { FieldControlDataAttributes } from '../../field/control/FieldControlDataAttributes';
import type { FieldRootState } from '../../field/root/FieldRoot';

export const DEFAULT_VALIDITY_STATE = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valid: null,
  valueMissing: false,
};

export const DEFAULT_FIELD_STATE_ATTRIBUTES: Pick<
  FieldRootState,
  'valid' | 'touched' | 'dirty' | 'filled' | 'focused'
> = {
  valid: null,
  touched: false,
  dirty: false,
  filled: false,
  focused: false,
};

export const DEFAULT_FIELD_ROOT_STATE: FieldRootState = {
  disabled: false,
  ...DEFAULT_FIELD_STATE_ATTRIBUTES,
};

export const fieldValidityMapping = {
  valid(value: boolean | null): Record<string, string> | null {
    if (value === null) {
      return null;
    }
    if (value) {
      return {
        [FieldControlDataAttributes.valid]: '',
      };
    }
    return {
      [FieldControlDataAttributes.invalid]: '',
    };
  },
};
