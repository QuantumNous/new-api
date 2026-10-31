import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { Side } from '../../utils/useAnchorPositioning';
import { fieldValidityMapping } from '../../internals/field-constants/constants';

export const triggerStateAttributesMapping = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) => (side ? { 'data-popup-side': side } : null),
  listEmpty: (empty: boolean) => (empty ? { 'data-list-empty': '' } : null),
} satisfies StateAttributesMapping<{
  open: boolean;
  valid: boolean | null;
  popupSide: Side | null;
  listEmpty: boolean;
  placeholder: boolean;
}>;
