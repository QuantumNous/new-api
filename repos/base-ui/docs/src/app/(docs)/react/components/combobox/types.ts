import { Combobox } from '@base-ui/react/combobox';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Combobox);

export const TypesCombobox = types;
export const TypesComboboxAdditional = AdditionalTypes;
