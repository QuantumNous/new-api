import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { RadioRootDataAttributes } from '../root/RadioRootDataAttributes';

export const stateAttributesMapping = {
  checked(value): Record<string, string> {
    if (value) {
      return { [RadioRootDataAttributes.checked]: '' };
    }
    return { [RadioRootDataAttributes.unchecked]: '' };
  },
  ...transitionStatusMapping,
  ...fieldValidityMapping,
} satisfies StateAttributesMapping<{
  checked: boolean;
  transitionStatus: TransitionStatus;
  valid: boolean | null;
}>;
