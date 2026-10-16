'use client';
import * as React from 'react';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { useControlled } from '@base-ui/utils/useControlled';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { ownerDocument } from '@base-ui/utils/owner';
import {
  FloatingNode,
  FloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
  type FloatingRootContext,
} from '../../floating-ui-react';
import { activeElement, contains } from '../../floating-ui-react/utils';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  type NavigationMenuPopupAutoSizeResetState,
  NavigationMenuRootContext,
  NavigationMenuTreeContext,
  useNavigationMenuRootContext,
} from './NavigationMenuRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { type BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { NavigationMenuPositionerCssVars } from '../positioner/NavigationMenuPositionerCssVars';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';

const blockedReturnFocusReasons = new Set<string>([
  REASONS.triggerHover,
  REASONS.outsidePress,
  REASONS.focusOut,
]);

function getPositionerFixedSize(positionerElement: HTMLElement) {
  // Read the last fixed positioner size rather than measuring the popup now:
  // during a controlled close, the popup can already be in its exit render and
  // report 0 before the closing transition gets a stable size to animate from.
  const width =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerWidth),
    ) || 0;
  const height =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerHeight),
    ) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * Groups all parts of the navigation menu.
 * Renders a `<nav>` element at the root, or `<div>` element when nested.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuRoot = React.forwardRef(function NavigationMenuRoot<Value = any>(
  componentProps: NavigationMenuRoot.Props<Value>,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    defaultValue = null,
    value: valueParam,
    onValueChange,
    actionsRef,
    delay = 50,
    closeDelay = 50,
    orientation = 'horizontal',
    onOpenChangeComplete,
  } = componentProps;

  const nested = useFloatingParentNodeId() != null;
  const parentRootContext = useNavigationMenuRootContext(true);

  const [value, setValueUnwrapped] = useControlled({
    controlled: valueParam,
    default: defaultValue,
    name: 'NavigationMenu',
    state: 'value',
  });

  // Derive open state from value being non-nullish
  const open = value != null;

  const closeReasonRef = React.useRef<NavigationMenuRoot.ChangeEventReason | undefined>(undefined);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const [positionerElement, setPositionerElement] = React.useState<HTMLElement | null>(null);
  const [popupElement, setPopupElement] = React.useState<HTMLElement | null>(null);
  const [viewportElement, setViewportElement] = React.useState<HTMLElement | null>(null);
  const [viewportTargetElement, setViewportTargetElement] = React.useState<HTMLElement | null>(
    null,
  );
  const [activationDirection, setActivationDirection] =
    React.useState<NavigationMenuRootContext['activationDirection']>(null);
  const [floatingRootContext, setFloatingRootContext] = React.useState<
    FloatingRootContext | undefined
  >(undefined);
  const [viewportInert, setViewportInert] = React.useState(false);

  const prevTriggerElementRef = React.useRef<Element | null | undefined>(null);
  const currentContentRef = React.useRef<HTMLDivElement | null>(null);
  const beforeInsideRef = React.useRef<HTMLSpanElement | null>(null);
  const afterInsideRef = React.useRef<HTMLSpanElement | null>(null);
  const beforeOutsideRef = React.useRef<HTMLSpanElement | null>(null);
  const afterOutsideRef = React.useRef<HTMLSpanElement | null>(null);
  // Shared across triggers so a newly active trigger can cancel a stale
  // popup auto-size reset scheduled by the previously active trigger.
  const popupAutoSizeResetRef = React.useRef<NavigationMenuPopupAutoSizeResetState>({
    abortController: null,
    owner: null,
  });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  useIsoLayoutEffect(() => {
    if (open) {
      return;
    }

    if (!positionerElement || !popupElement) {
      return;
    }

    const closeTransitionSize = getPositionerFixedSize(positionerElement);

    if (!closeTransitionSize) {
      return;
    }

    // No cleanup is needed for this fixed size: if the popup unmounts, the inline
    // styles are removed with it. If it stays mounted, reopening runs the trigger's
    // sizing logic which clears these vars via `clearFixedSizes`/`setAutoSizes`.
    setSharedFixedSize(
      popupElement,
      positionerElement,
      closeTransitionSize.width,
      closeTransitionSize.height,
    );
  }, [open, popupElement, positionerElement]);

  React.useEffect(() => {
    setViewportInert(false);
  }, [value]);

  const setValue = useStableCallback(
    (
      nextValue: NavigationMenuRoot.Value<Value>,
      eventDetails: NavigationMenuRoot.ChangeEventDetails,
    ) => {
      if (nextValue == null) {
        closeReasonRef.current = eventDetails.reason;
      }

      if (nextValue !== value) {
        onValueChange?.(nextValue, eventDetails);
      }

      if (eventDetails.isCanceled) {
        return;
      }

      if (nextValue == null) {
        setActivationDirection(null);
        setFloatingRootContext(undefined);
      }

      setValueUnwrapped(nextValue);

      if (
        nested &&
        nextValue == null &&
        eventDetails.reason === REASONS.linkPress &&
        parentRootContext
      ) {
        parentRootContext.setValue(null, eventDetails);
      }
    },
  );

  const handleUnmount = useStableCallback(() => {
    const doc = ownerDocument(rootRef.current);
    const activeEl = activeElement(doc);

    const isReturnFocusBlocked = closeReasonRef.current
      ? blockedReturnFocusReasons.has(closeReasonRef.current)
      : false;

    if (
      !isReturnFocusBlocked &&
      isHTMLElement(prevTriggerElementRef.current) &&
      (activeEl === ownerDocument(popupElement).body || contains(popupElement, activeEl)) &&
      popupElement
    ) {
      prevTriggerElementRef.current.focus({ preventScroll: true });
      prevTriggerElementRef.current = undefined;
    }

    setMounted(false);
    onOpenChangeComplete?.(false);
    setActivationDirection(null);
    setFloatingRootContext(undefined);

    currentContentRef.current = null;
    closeReasonRef.current = undefined;
  });

  // Providing `actionsRef` opts into manual unmounting, so close completion hooks leave it mounted.
  React.useImperativeHandle(actionsRef, () => ({ unmount: handleUnmount }), [handleUnmount]);

  useOpenChangeComplete({
    enabled: !actionsRef,
    open,
    ref: { current: popupElement },
    onComplete() {
      if (!open) {
        handleUnmount();
      }
    },
  });

  useOpenChangeComplete({
    enabled: !actionsRef,
    open,
    ref: { current: viewportTargetElement },
    onComplete() {
      if (!open) {
        handleUnmount();
      }
    },
  });

  const contextActivationDirection = open ? activationDirection : null;

  const contextValue: NavigationMenuRootContext<Value> = React.useMemo(
    () => ({
      open,
      value,
      setValue,
      mounted,
      transitionStatus,
      positionerElement,
      setPositionerElement,
      popupElement,
      setPopupElement,
      viewportElement,
      setViewportElement,
      viewportTargetElement,
      setViewportTargetElement,
      activationDirection: contextActivationDirection,
      setActivationDirection,
      floatingRootContext,
      setFloatingRootContext,
      currentContentRef,
      nested,
      rootRef,
      beforeInsideRef,
      afterInsideRef,
      beforeOutsideRef,
      afterOutsideRef,
      prevTriggerElementRef,
      popupAutoSizeResetRef,
      delay,
      closeDelay,
      orientation,
      viewportInert,
      setViewportInert,
    }),
    [
      open,
      value,
      setValue,
      mounted,
      transitionStatus,
      positionerElement,
      popupElement,
      viewportElement,
      viewportTargetElement,
      contextActivationDirection,
      floatingRootContext,
      nested,
      delay,
      closeDelay,
      orientation,
      viewportInert,
    ],
  );

  const jsx = (
    <NavigationMenuRootContext.Provider value={contextValue}>
      <TreeContext componentProps={componentProps} forwardedRef={forwardedRef}>
        {componentProps.children}
      </TreeContext>
    </NavigationMenuRootContext.Provider>
  );

  if (!nested) {
    // FloatingTree provides context to nested menus
    return <FloatingTree>{jsx}</FloatingTree>;
  }

  return jsx;
}) as {
  <Value = any>(props: NavigationMenuRoot.Props<Value>): React.JSX.Element;
};

function TreeContext<Value>(props: {
  componentProps: NavigationMenuRoot.Props<Value>;
  forwardedRef: React.ForwardedRef<HTMLElement>;
  children: React.ReactNode;
}) {
  const {
    className,
    render,
    defaultValue,
    value: valueParam,
    onValueChange,
    actionsRef,
    delay,
    closeDelay,
    orientation,
    onOpenChangeComplete,
    style,
    ...elementProps
  } = props.componentProps;

  const nodeId = useFloatingNodeId();
  const { rootRef, nested, open } = useNavigationMenuRootContext();

  const state: NavigationMenuRootState = {
    open,
    nested,
  };

  const element = useRenderElement(nested ? 'div' : 'nav', props.componentProps, {
    state,
    ref: [props.forwardedRef, rootRef],
    props: elementProps,
  });

  return (
    <NavigationMenuTreeContext.Provider value={nodeId}>
      <FloatingNode id={nodeId}>{element}</FloatingNode>
    </NavigationMenuTreeContext.Provider>
  );
}

export interface NavigationMenuRootState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * Whether the navigation menu is nested.
   */
  nested: boolean;
}

export interface NavigationMenuRootProps<Value = any> extends BaseUIComponentProps<
  'nav',
  NavigationMenuRootState
> {
  /**
   * A ref to imperative actions.
   */
  actionsRef?: React.RefObject<NavigationMenuRoot.Actions | null> | undefined;
  /**
   * Event handler called after any animations complete when the navigation menu is closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * The controlled value of the navigation menu item that should be currently open.
   * When non-nullish, the menu will be open. When nullish, the menu will be closed.
   *
   * To render an uncontrolled navigation menu, use the `defaultValue` prop instead.
   * @default null
   */
  value?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `value` prop instead.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?:
    | ((value: Value | null, eventDetails: NavigationMenuRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * How long to wait before opening the navigation popup. Specified in milliseconds.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the navigation popup. Specified in milliseconds.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The orientation of the navigation menu.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface NavigationMenuRootActions {
  unmount: () => void;
}

export type NavigationMenuRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.triggerHover
  | typeof REASONS.outsidePress
  | typeof REASONS.listNavigation
  | typeof REASONS.focusOut
  | typeof REASONS.escapeKey
  | typeof REASONS.linkPress
  | typeof REASONS.none;

export type NavigationMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason>;

export namespace NavigationMenuRoot {
  export type State = NavigationMenuRootState;
  export type Props<TValue = any> = NavigationMenuRootProps<TValue>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}
