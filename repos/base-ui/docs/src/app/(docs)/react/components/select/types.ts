import { Select } from '@base-ui/react/select';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Select);

export const TypesSelect = types;
export const TypesSelectAdditional = AdditionalTypes;
