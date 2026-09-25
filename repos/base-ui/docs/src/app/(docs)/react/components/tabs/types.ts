import { Tabs } from '@base-ui/react/tabs';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Tabs);

export const TypesTabs = types;
export const TypesTabsAdditional = AdditionalTypes;
