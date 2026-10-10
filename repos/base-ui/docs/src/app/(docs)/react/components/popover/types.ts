import { Popover } from '@base-ui/react/popover';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Popover);

export const TypesPopover = types;
export const TypesPopoverAdditional = AdditionalTypes;
