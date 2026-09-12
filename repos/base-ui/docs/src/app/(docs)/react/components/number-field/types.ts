import { NumberField } from '@base-ui/react/number-field';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, NumberField);

export const TypesNumberField = types;
export const TypesNumberFieldAdditional = AdditionalTypes;
