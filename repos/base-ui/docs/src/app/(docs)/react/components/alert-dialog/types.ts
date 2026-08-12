import { AlertDialog } from '@base-ui/react/alert-dialog';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, AlertDialog);

export const TypesAlertDialog = types;
export const TypesAlertDialogAdditional = AdditionalTypes;
