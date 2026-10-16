import { Collapsible } from '@base-ui/react/collapsible';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Collapsible);

export const TypesCollapsible = types;
export const TypesCollapsibleAdditional = AdditionalTypes;
