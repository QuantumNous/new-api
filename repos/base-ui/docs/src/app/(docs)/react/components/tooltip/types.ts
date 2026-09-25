import { Tooltip } from '@base-ui/react/tooltip';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Tooltip);

export const TypesTooltip = types;
export const TypesTooltipAdditional = AdditionalTypes;
