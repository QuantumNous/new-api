import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { MenuCheckboxItemDataAttributes } from '../checkbox-item/MenuCheckboxItemDataAttributes';

export const itemMapping: StateAttributesMapping<{ checked: boolean }> = {
  checked(value): Record<string, string> {
    if (value) {
      return {
        [MenuCheckboxItemDataAttributes.checked]: '',
      };
    }
    return {
      [MenuCheckboxItemDataAttributes.unchecked]: '',
    };
  },
  ...transitionStatusMapping,
};
