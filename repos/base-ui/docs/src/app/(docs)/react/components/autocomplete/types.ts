import { Autocomplete } from '@base-ui/react/autocomplete';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Autocomplete);

export const TypesAutocomplete = types;
export const TypesAutocompleteAdditional = AdditionalTypes;
