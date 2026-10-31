import { PreviewCard } from '@base-ui/react/preview-card';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, PreviewCard);

export const TypesPreviewCard = types;
export const TypesPreviewCardAdditional = AdditionalTypes;
