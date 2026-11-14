import { Toolbar } from '@base-ui/react/toolbar';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Toolbar);

export const TypesToolbar = types;
export const TypesToolbarAdditional = AdditionalTypes;
