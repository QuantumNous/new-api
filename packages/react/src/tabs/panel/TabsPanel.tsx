'use client';
import * as React from 'react';
import { inertValue } from '@base-ui/utils/inertValue';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsRootState } from '../root/TabsRoot';
import type { TabsTab } from '../tab/TabsTab';
import { TabsPanelDataAttributes } from './TabsPanelDataAttributes';

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export const TabsPanel = React.forwardRef(function TabsPanel(
  componentProps: TabsPanel.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { className, value, render, keepMounted = false, style, ...elementProps } = componentProps;

  const {
    value: selectedValue,
    getTabIdByPanelValue,
    orientation,
    tabActivationDirection,
    registerMountedTabPanel,
    unregisterMountedTabPanel,
  } = useTabsRootContext();

  const id = useBaseUiId();

  const metadata = React.useMemo(
    () => ({
      id,
      value,
    }),
    [id, value],
  );

  const { ref: listItemRef, index } = useCompositeListItem<TabsPanel.Metadata>({
    metadata,
  });

  const open = value === selectedValue;
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(open);
  const hidden = !mounted;

  const correspondingTabId = getTabIdByPanelValue(value);

  const state: TabsPanelState = {
    hidden,
    orientation,
    tabActivationDirection,
    transitionStatus,
  };

  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef, listItemRef, panelRef],
    props: [
      {
        'aria-labelledby': correspondingTabId,
        hidden,
        id,
        role: 'tabpanel',
        tabIndex: open ? 0 : -1,
        inert: inertValue(!open),
        [TabsPanelDataAttributes.index as string]: index,
      },
      elementProps,
    ],
    stateAttributesMapping,
  });

  useOpenChangeComplete({
    open,
    ref: panelRef,
    onComplete() {
      if (!open) {
        setMounted(false);
      }
    },
  });

  useIsoLayoutEffect(() => {
    if (hidden && !keepMounted) {
      return undefined;
    }

    if (id == null) {
      return undefined;
    }

    registerMountedTabPanel(value, id);
    return () => {
      unregisterMountedTabPanel(value, id);
    };
  }, [hidden, keepMounted, value, id, registerMountedTabPanel, unregisterMountedTabPanel]);

  const shouldRender = keepMounted || mounted;
  if (!shouldRender) {
    return null;
  }

  return element;
});

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTab.Value;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps extends BaseUIComponentProps<'div', TabsPanelState> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}
