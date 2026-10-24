import { Avatar } from '@base-ui/react/avatar';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Avatar);

export const TypesAvatar = types;
export const TypesAvatarAdditional = AdditionalTypes;
