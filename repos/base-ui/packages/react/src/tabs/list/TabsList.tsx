'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { EMPTY_ARRAY } from '@base-ui/utils/empty';
import { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { TabsRoot, TabsRootState } from '../root/TabsRoot';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTab } from '../tab/TabsTab';
import { TabsListContext } from './TabsListContext';

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export const TabsList = React.forwardRef(function TabsList(
  componentProps: TabsList.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    activateOnFocus = false,
    className,
    loopFocus = true,
    render,
    style,
    ...elementProps
  } = componentProps;

  const { onValueChange, orientation, value, setTabMap, tabActivationDirection } =
    useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = React.useState(0);
  const [tabsListElement, setTabsListElement] = React.useState<HTMLElement | null>(null);

  const indicatorUpdateListenersRef = React.useRef(new Set<() => void>());
  const tabResizeObserverElementsRef = React.useRef(new Set<HTMLElement>());
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  useIsoLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      indicatorUpdateListenersRef.current.forEach((listener) => {
        listener();
      });
    });

    resizeObserverRef.current = resizeObserver;

    if (tabsListElement) {
      resizeObserver.observe(tabsListElement);
    }

    tabResizeObserverElementsRef.current.forEach((element) => {
      resizeObserver.observe(element);
    });

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, [tabsListElement]);

  const registerIndicatorUpdateListener = useStableCallback((listener: () => void) => {
    indicatorUpdateListenersRef.current.add(listener);
    return () => {
      indicatorUpdateListenersRef.current.delete(listener);
    };
  });

  const registerTabResizeObserverElement = useStableCallback((element: HTMLElement) => {
    tabResizeObserverElementsRef.current.add(element);
    resizeObserverRef.current?.observe(element);
    return () => {
      tabResizeObserverElementsRef.current.delete(element);
      resizeObserverRef.current?.unobserve(element);
    };
  });

  const onTabActivation = useStableCallback(
    (newValue: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => {
      if (newValue !== value) {
        onValueChange(newValue, eventDetails);
      }
    },
  );

  const state: TabsListState = {
    orientation,
    tabActivationDirection,
  };

  const defaultProps: HTMLProps = {
    'aria-orientation': orientation === 'vertical' ? 'vertical' : undefined,
    role: 'tablist',
  };

  const tabsListContextValue: TabsListContext = React.useMemo(
    () => ({
      activateOnFocus,
      highlightedTabIndex,
      registerIndicatorUpdateListener,
      registerTabResizeObserverElement,
      onTabActivation,
      setHighlightedTabIndex,
      tabsListElement,
    }),
    [
      activateOnFocus,
      highlightedTabIndex,
      registerIndicatorUpdateListener,
      registerTabResizeObserverElement,
      onTabActivation,
      setHighlightedTabIndex,
      tabsListElement,
    ],
  );

  return (
    <TabsListContext.Provider value={tabsListContextValue}>
      <CompositeRoot
        render={render}
        className={className}
        style={style}
        state={state}
        refs={[forwardedRef, setTabsListElement]}
        props={[defaultProps, elementProps]}
        stateAttributesMapping={tabsStateAttributesMapping}
        highlightedIndex={highlightedTabIndex}
        enableHomeAndEndKeys
        loopFocus={loopFocus}
        orientation={orientation}
        onHighlightedIndexChange={setHighlightedTabIndex}
        onMapChange={setTabMap}
        disabledIndices={EMPTY_ARRAY as number[]}
      />
    </TabsListContext.Provider>
  );
});

export interface TabsListState extends TabsRootState {}

export interface TabsListProps extends BaseUIComponentProps<'div', TabsListState> {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace TabsList {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
