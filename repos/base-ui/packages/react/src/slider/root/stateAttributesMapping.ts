import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { SliderRootState } from './SliderRoot';
import { fieldValidityMapping } from '../../internals/field-constants/constants';

export const sliderStateAttributesMapping: StateAttributesMapping<SliderRootState> = {
  activeThumbIndex: () => null,
  max: () => null,
  min: () => null,
  minStepsBetweenValues: () => null,
  step: () => null,
  values: () => null,
  ...fieldValidityMapping,
};
