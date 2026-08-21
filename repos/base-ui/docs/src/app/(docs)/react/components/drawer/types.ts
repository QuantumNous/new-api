import { Drawer } from '@base-ui/react/drawer';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Drawer);

export const TypesDrawer = types;
export const TypesDrawerAdditional = AdditionalTypes;
