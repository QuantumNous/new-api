'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import type { BaseUIComponentProps, Orientation as BaseOrientation } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { TabsRootContext } from './TabsRootContext';
import { tabsStateAttributesMapping } from './stateAttributesMapping';
import type { TabsTab } from '../tab/TabsTab';
import type { TabsPanel } from '../panel/TabsPanel';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export const TabsRoot = React.forwardRef(function TabsRoot(
  componentProps: TabsRoot.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    className,
    defaultValue: defaultValueProp = 0,
    onValueChange: onValueChangeProp,
    orientation = 'horizontal',
    render,
    value: valueProp,
    style,
    ...elementProps
  } = componentProps;

  // Track whether the user explicitly provided a defined `defaultValue` prop.
  // Used to determine if we should honor a disabled tab selection.
  const hasExplicitDefaultValueProp = componentProps.defaultValue !== undefined;

  const tabPanelRefs = React.useRef<(HTMLElement | null)[]>([]);
  const [mountedTabPanels, setMountedTabPanels] = React.useState(
    () => new Map<TabsTab.Value | number, string>(),
  );

  const [value, setValue] = useControlled({
    controlled: valueProp,
    default: defaultValueProp,
    name: 'Tabs',
    state: 'value',
  });

  const isControlled = valueProp !== undefined;

  const [tabMap, setTabMap] = React.useState(
    () => new Map<Node, CompositeMetadata<TabsTab.Metadata> | null>(),
  );
  const lastKnownTabElementRef = React.useRef<Node | undefined>(undefined);

  // Used for activation direction detection via tab element positions.
  const getTabElementBySelectedValue = React.useCallback(
    (selectedValue: TabsTab.Value | undefined): HTMLElement | null => {
      if (selectedValue === undefined) {
        return null;
      }

      for (const [tabElement, tabMetadata] of tabMap.entries()) {
        if (tabMetadata != null && selectedValue === (tabMetadata.value ?? tabMetadata.index)) {
          return tabElement as HTMLElement;
        }
      }

      return null;
    },
    [tabMap],
  );

  const [activationDirectionState, setActivationDirectionState] = React.useState(() => ({
    previousValue: value,
    tabActivationDirection: 'none' as TabsTab.ActivationDirection,
  }));
  const { previousValue, tabActivationDirection: committedTabActivationDirection } =
    activationDirectionState;

  let tabActivationDirection = committedTabActivationDirection;
  let directionComputationIncomplete = false;

  // Compute activation direction during render when value changes so children see
  // the correct direction on their very first render after the selection update.
  // The previous value snapshot is stored in state and synced after commit.
  // https://github.com/mui/base-ui/issues/3873
  if (previousValue !== value) {
    tabActivationDirection = computeActivationDirection(previousValue, value, orientation, tabMap);

    // When a new tab is added and selected in the same controlled update,
    // the tab element may not yet be registered in tabMap, so direction was
    // computed from a value-based fallback. Keep the previous value snapshot
    // stale so we re-compute from DOM positions once tabMap is up to date.
    directionComputationIncomplete =
      previousValue != null && value != null && getTabElementBySelectedValue(value) == null;
  }

  const nextPreviousValue = directionComputationIncomplete ? previousValue : value;
  const shouldSyncActivationDirectionState =
    previousValue !== nextPreviousValue ||
    committedTabActivationDirection !== tabActivationDirection;

  useIsoLayoutEffect(() => {
    if (!shouldSyncActivationDirectionState) {
      return;
    }

    setActivationDirectionState({
      previousValue: nextPreviousValue,
      tabActivationDirection,
    });
  }, [nextPreviousValue, shouldSyncActivationDirectionState, tabActivationDirection]);

  const onValueChange = useStableCallback(
    (newValue: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => {
      const activationDirection = computeActivationDirection(value, newValue, orientation, tabMap);

      eventDetails.activationDirection = activationDirection;

      onValueChangeProp?.(newValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      setValue(newValue);
    },
  );

  const notifyAutomaticValueChange = useStableCallback(
    (nextValue: TabsTab.Value, reason: TabsRoot.ChangeEventReason) => {
      onValueChangeProp?.(
        nextValue,
        createChangeEventDetails(reason, undefined, undefined, {
          activationDirection: 'none',
        }),
      );
    },
  );

  const registerMountedTabPanel = useStableCallback(
    (panelValue: TabsTab.Value | number, panelId: string) => {
      setMountedTabPanels((prev) => {
        if (prev.get(panelValue) === panelId) {
          return prev;
        }

        const next = new Map(prev);
        next.set(panelValue, panelId);
        return next;
      });
    },
  );

  const unregisterMountedTabPanel = useStableCallback(
    (panelValue: TabsTab.Value | number, panelId: string) => {
      setMountedTabPanels((prev) => {
        if (!prev.has(panelValue) || prev.get(panelValue) !== panelId) {
          return prev;
        }

        const next = new Map(prev);
        next.delete(panelValue);
        return next;
      });
    },
  );

  // get the `id` attribute of <Tabs.Panel> to set as the value of `aria-controls` on <Tabs.Tab>
  const getTabPanelIdByValue = React.useCallback(
    (tabValue: TabsTab.Value) => {
      return mountedTabPanels.get(tabValue);
    },
    [mountedTabPanels],
  );

  // get the `id` attribute of <Tabs.Tab> to set as the value of `aria-labelledby` on <Tabs.Panel>
  const getTabIdByPanelValue = React.useCallback(
    (tabPanelValue: TabsTab.Value) => {
      for (const tabMetadata of tabMap.values()) {
        if (tabPanelValue === tabMetadata?.value) {
          return tabMetadata?.id;
        }
      }
      return undefined;
    },
    [tabMap],
  );

  const tabsContextValue: TabsRootContext = React.useMemo(
    () => ({
      getTabElementBySelectedValue,
      getTabIdByPanelValue,
      getTabPanelIdByValue,
      onValueChange,
      orientation,
      registerMountedTabPanel,
      setTabMap,
      unregisterMountedTabPanel,
      tabActivationDirection,
      value,
    }),
    [
      getTabElementBySelectedValue,
      getTabIdByPanelValue,
      getTabPanelIdByValue,
      onValueChange,
      orientation,
      registerMountedTabPanel,
      setTabMap,
      unregisterMountedTabPanel,
      tabActivationDirection,
      value,
    ],
  );

  const selectedTabMetadata = React.useMemo(() => {
    for (const tabMetadata of tabMap.values()) {
      if (tabMetadata != null && tabMetadata.value === value) {
        return tabMetadata;
      }
    }
    return undefined;
  }, [tabMap, value]);

  // Find the first non-disabled tab value.
  // Used as a fallback when the current selection is disabled or missing.
  const firstEnabledTabValue = React.useMemo(() => {
    for (const tabMetadata of tabMap.values()) {
      if (tabMetadata != null && !tabMetadata.disabled) {
        return tabMetadata.value;
      }
    }
    return undefined;
  }, [tabMap]);

  // Implicit uncontrolled selections are still automatic changes, so notify
  // once when the tabs first register. Explicit defaults are treated as user-owned.
  const shouldNotifyInitialValueChangeRef = React.useRef(!hasExplicitDefaultValueProp);
  // useControlled warns if defaultValue changes after mount, but the
  // disabled-default honor policy below still needs a stable initial value.
  const initialDefaultValueRef = React.useRef(defaultValueProp);
  // An explicit defaultValue can intentionally point at a disabled tab on mount.
  // Once that selection becomes valid, later disabled states should fall back.
  const shouldHonorDisabledDefaultValueRef = React.useRef(hasExplicitDefaultValueProp);
  const didRegisterTabsRef = React.useRef(false);

  // Uncontrolled roots own automatic fallback. Controlled roots keep the exact
  // value supplied by the parent, even when that tab is disabled or missing.
  useIsoLayoutEffect(() => {
    if (isControlled) {
      return;
    }

    function commitAutomaticValueChange(
      fallbackValue: TabsTab.Value,
      fallbackReason: TabsRoot.ChangeEventReason,
    ) {
      setValue(fallbackValue);
      // Automatic fallbacks are not directional transitions; reset the direction
      // alongside the value so the batched commit keeps both in sync.
      setActivationDirectionState((prev) => {
        if (prev.previousValue === fallbackValue && prev.tabActivationDirection === 'none') {
          return prev;
        }

        return {
          previousValue: fallbackValue,
          tabActivationDirection: 'none',
        };
      });
      notifyAutomaticValueChange(fallbackValue, fallbackReason);
      // Mark the initial notification as delivered only after the consumer
      // callback returns. The fallback value is queued first so automatic
      // consistency updates are not cancelable through a throwing handler.
      shouldNotifyInitialValueChangeRef.current = false;
    }

    if (tabMap.size === 0) {
      // A Suspense boundary outside the root can clean up layout effects while
      // keeping the previous tabs connected. Don't treat that as removal.
      if (
        didRegisterTabsRef.current &&
        value !== null &&
        !lastKnownTabElementRef.current?.isConnected
      ) {
        commitAutomaticValueChange(null, REASONS.missing);
      }
      return;
    }

    didRegisterTabsRef.current = true;
    lastKnownTabElementRef.current = tabMap.keys().next().value;

    const selectionIsDisabled = selectedTabMetadata?.disabled;
    const selectionIsMissing = selectedTabMetadata == null && value !== null;

    if (!selectionIsDisabled && value === initialDefaultValueRef.current) {
      shouldHonorDisabledDefaultValueRef.current = false;
    }

    if (
      shouldHonorDisabledDefaultValueRef.current &&
      selectionIsDisabled &&
      value === initialDefaultValueRef.current
    ) {
      return;
    }

    const shouldNotifyInitialValueChange = shouldNotifyInitialValueChangeRef.current;

    if (selectionIsDisabled || selectionIsMissing) {
      const fallbackValue = firstEnabledTabValue ?? null;

      if (value === fallbackValue) {
        // Already at the fallback value; no commit or notification needed,
        // but record that the implicit-initial transition has resolved.
        shouldNotifyInitialValueChangeRef.current = false;
        return;
      }

      let fallbackReason: TabsRoot.ChangeEventReason = REASONS.missing;

      if (shouldNotifyInitialValueChange) {
        fallbackReason = REASONS.initial;
      } else if (selectionIsDisabled) {
        fallbackReason = REASONS.disabled;
      }

      commitAutomaticValueChange(fallbackValue, fallbackReason);
      return;
    }

    if (shouldNotifyInitialValueChange && selectedTabMetadata != null) {
      notifyAutomaticValueChange(value, REASONS.initial);
      shouldNotifyInitialValueChangeRef.current = false;
    }
  }, [
    firstEnabledTabValue,
    isControlled,
    notifyAutomaticValueChange,
    selectedTabMetadata,
    setValue,
    tabMap,
    value,
  ]);

  const state: TabsRootState = {
    orientation,
    tabActivationDirection,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: elementProps,
    stateAttributesMapping: tabsStateAttributesMapping,
  });

  return (
    <TabsRootContext.Provider value={tabsContextValue}>
      <CompositeList<TabsPanel.Metadata> elementsRef={tabPanelRefs}>{element}</CompositeList>
    </TabsRootContext.Provider>
  );
});

function computeActivationDirection(
  oldValue: TabsTab.Value | null,
  newValue: TabsTab.Value | null,
  orientation: 'horizontal' | 'vertical',
  tabMap: Map<Node, CompositeMetadata<TabsTab.Metadata> | null>,
): TabsTab.ActivationDirection {
  if (oldValue == null || newValue == null) {
    return 'none';
  }

  let oldTab: HTMLElement | null = null;
  let newTab: HTMLElement | null = null;

  for (const [tabElement, tabMetadata] of tabMap.entries()) {
    if (tabMetadata == null) {
      continue;
    }

    const tabValue = tabMetadata.value ?? tabMetadata.index;
    if (oldValue === tabValue) {
      oldTab = tabElement as HTMLElement;
    }
    if (newValue === tabValue) {
      newTab = tabElement as HTMLElement;
    }
    if (oldTab != null && newTab != null) {
      break;
    }
  }

  if (oldTab == null || newTab == null) {
    // Fallback for dynamic tabs: when a tab element isn't registered yet
    // (e.g. added and selected in the same update), infer direction from
    // the values themselves. Works for comparable types (numbers, strings).
    if (
      oldTab !== newTab &&
      (typeof oldValue === 'number' || typeof oldValue === 'string') &&
      typeof oldValue === typeof newValue
    ) {
      if (orientation === 'horizontal') {
        return newValue > oldValue ? 'right' : 'left';
      }
      return newValue > oldValue ? 'down' : 'up';
    }
    return 'none';
  }

  const oldRect = oldTab.getBoundingClientRect();
  const newRect = newTab.getBoundingClientRect();

  if (orientation === 'horizontal') {
    if (newRect.left < oldRect.left) {
      return 'left';
    }
    if (newRect.left > oldRect.left) {
      return 'right';
    }
  } else {
    if (newRect.top < oldRect.top) {
      return 'up';
    }
    if (newRect.top > oldRect.top) {
      return 'down';
    }
  }

  return 'none';
}

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsRootProps extends BaseUIComponentProps<'div', TabsRootState> {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTab.Value | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTab.Value | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRoot.Orientation | undefined;
  /**
   * Callback invoked when new value is being set.
   *
   * The event `reason` is `'none'` for user-initiated changes, such as a click
   * or keyboard navigation; `'initial'` for the first automatic selection or
   * fallback in uncontrolled roots when `defaultValue` is omitted or
   * `undefined`, including when the implicit initial value is disabled or
   * missing; `'disabled'` for automatic fallback when the selected tab becomes
   * disabled in uncontrolled roots; or `'missing'` for automatic fallback when
   * the selected tab is removed, or when an explicit `defaultValue` never
   * matches a mounted tab in uncontrolled roots.
   *
   * For automatic changes, the selected value can be `null` when no enabled Tab
   * is available as a fallback.
   *
   * Automatic changes cannot be canceled; calling `eventDetails.cancel()` for
   * `'initial'`, `'disabled'`, or `'missing'` has no effect.
   */
  onValueChange?:
    | ((value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void)
    | undefined;
}

export type TabsRootChangeEventReason =
  | typeof REASONS.none
  | typeof REASONS.disabled
  | typeof REASONS.missing
  | typeof REASONS.initial;
export type TabsRootChangeEventDetails = BaseUIChangeEventDetails<
  TabsRoot.ChangeEventReason,
  { activationDirection: TabsTab.ActivationDirection }
>;

export namespace TabsRoot {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
