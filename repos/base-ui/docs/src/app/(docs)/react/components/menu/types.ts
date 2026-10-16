import { Menu } from '@base-ui/react/menu';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Menu);

export const TypesMenu = types;
export const TypesMenuAdditional = AdditionalTypes;
