import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ProgressRootState } from './ProgressRoot';
import { ProgressRootDataAttributes } from './ProgressRootDataAttributes';

export const progressStateAttributesMapping: StateAttributesMapping<ProgressRootState> = {
  status(value): Record<string, string> | null {
    if (value === 'progressing') {
      return { [ProgressRootDataAttributes.progressing]: '' };
    }
    if (value === 'complete') {
      return { [ProgressRootDataAttributes.complete]: '' };
    }
    if (value === 'indeterminate') {
      return { [ProgressRootDataAttributes.indeterminate]: '' };
    }
    return null;
  },
};
