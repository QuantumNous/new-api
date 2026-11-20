import { ContextMenu } from '@base-ui/react/context-menu';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, ContextMenu);

export const TypesContextMenu = types;
export const TypesContextMenuAdditional = AdditionalTypes;
