import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, NavigationMenu);

export const TypesNavigationMenu = types;
export const TypesNavigationMenuAdditional = AdditionalTypes;
