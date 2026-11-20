import { Switch } from '@base-ui/react/switch';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Switch);

export const TypesSwitch = types;
export const TypesSwitchAdditional = AdditionalTypes;
