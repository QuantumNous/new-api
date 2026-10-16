import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';

export const rootStateAttributesMapping: StateAttributesMapping<OTPFieldRootState> = {
  value: () => null,
  length: () => null,
  ...fieldValidityMapping,
};

export const inputStateAttributesMapping: StateAttributesMapping<OTPFieldInputState> = {
  value: () => null,
  index: () => null,
  ...fieldValidityMapping,
};
