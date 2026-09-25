import { Dialog } from '@base-ui/react/dialog';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Dialog);

export const TypesDialog = types;
export const TypesDialogAdditional = AdditionalTypes;
