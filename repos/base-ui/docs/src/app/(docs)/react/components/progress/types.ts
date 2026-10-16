import { Progress } from '@base-ui/react/progress';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, Progress);

export const TypesProgress = types;
export const TypesProgressAdditional = AdditionalTypes;
