import * as MergeProps from '@base-ui/react/merge-props';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types } = createMultipleTypes(import.meta.url, MergeProps);

export const TypesMergeProps = types.mergeProps;
export const TypesMergePropsN = types.mergePropsN;
