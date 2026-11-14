import { Checkbox } from '@base-ui/react/checkbox';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Checkbox);

export const TypesCheckbox = types;
export const TypesCheckboxAdditional = AdditionalTypes;
