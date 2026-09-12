import type { TabsRootState } from './TabsRoot';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { TabsRootDataAttributes } from './TabsRootDataAttributes';

export const tabsStateAttributesMapping: StateAttributesMapping<TabsRootState> = {
  tabActivationDirection: (dir) => ({
    [TabsRootDataAttributes.activationDirection]: dir,
  }),
};
