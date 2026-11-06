'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerWindow } from '@base-ui/utils/owner';
import { useTimeout } from '@base-ui/utils/useTimeout';
import {
  disableFocusInside,
  enableFocusInside,
  isOutsideEvent,
} from '../../floating-ui-react/utils';
import { getEmptyRootContext } from '../../floating-ui-react/utils/getEmptyRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuPortalContext } from '../portal/NavigationMenuPortalContext';
import {
  useAnchorPositioning,
  type Align,
  type Side,
  type UseAnchorPositioningSharedParameters,
} from '../../utils/useAnchorPositioning';
import { NavigationMenuPositionerContext } from './NavigationMenuPositionerContext';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { adaptiveOrigin } from '../../utils/adaptiveOriginMiddleware';
import { usePositioner } from '../../utils/usePositioner';

const EMPTY_ROOT_CONTEXT = getEmptyRootContext();

/**
 * Positions the navigation menu against the currently active trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuPositioner = React.forwardRef(function NavigationMenuPositioner(
  componentProps: NavigationMenuPositioner.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    open,
    mounted,
    positionerElement,
    setPositionerElement,
    floatingRootContext,
    nested,
    transitionStatus,
  } = useNavigationMenuRootContext();

  const {
    className,
    render,
    anchor,
    positionMethod = 'absolute',
    side = 'bottom',
    align = 'center',
    sideOffset = 0,
    alignOffset = 0,
    collisionBoundary = 'clipping-ancestors',
    collisionPadding = 5,
    collisionAvoidance = nested ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE,
    arrowPadding = 5,
    sticky = false,
    disableAnchorTracking = false,
    style,
    ...elementProps
  } = componentProps;

  const keepMounted = useNavigationMenuPortalContext();
  const nodeId = useNavigationMenuTreeContext();

  const initialInstantTimeout = useTimeout();
  const resizeTimeout = useTimeout();

  // When the menu is initially open, disable the positioner's transition for one frame
  // so a default value does not animate in from the unpositioned portal state.
  const [instant, setInstant] = React.useState(open);
  const needsInitialInstantResetRef = React.useRef(open);

  const positionerRef = React.useRef<HTMLDivElement | null>(null);
  const prevTriggerElementRef = React.useRef<Element | null>(null);

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  React.useEffect(() => {
    if (!positionerElement) {
      return undefined;
    }

    // Make sure elements inside the portal element are tabbable only when the
    // portal has already been focused, either by tabbing into a focus trap
    // element outside or using the mouse.
    function onFocus(event: FocusEvent) {
      if (positionerElement && isOutsideEvent(event)) {
        const focusing = event.type === 'focusin';
        const manageFocus = focusing ? enableFocusInside : disableFocusInside;
        manageFocus(positionerElement);
      }
    }

    // Listen to the event on the capture phase so they run before the focus
    // trap elements onFocus prop is called.
    return mergeCleanups(
      addEventListener(positionerElement, 'focusin', onFocus, true),
      addEventListener(positionerElement, 'focusout', onFocus, true),
    );
  }, [positionerElement]);

  const domReference = (floatingRootContext || EMPTY_ROOT_CONTEXT).useState('domReferenceElement');

  const positioning = useAnchorPositioning({
    anchor: anchor ?? domReference ?? prevTriggerElementRef,
    positionMethod,
    mounted,
    side,
    sideOffset,
    align,
    alignOffset,
    arrowPadding,
    collisionBoundary,
    collisionPadding,
    sticky,
    disableAnchorTracking,
    keepMounted,
    floatingRootContext,
    collisionAvoidance,
    nodeId,
    // Allows the menu to remain anchored without wobbling while its size
    // and position transition simultaneously when side=top or side=left.
    adaptiveOrigin,
  });

  const state: NavigationMenuPositionerState = {
    open,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    instant,
  };

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    if (needsInitialInstantResetRef.current) {
      initialInstantTimeout.start(0, () => {
        needsInitialInstantResetRef.current = false;

        if (!resizeTimeout.isStarted()) {
          setInstant(false);
        }
      });
    }

    function handleResize() {
      ReactDOM.flushSync(() => {
        setInstant(true);
      });

      resizeTimeout.start(100, () => {
        setInstant(false);
      });
    }

    const win = ownerWindow(positionerElement);
    return addEventListener(win, 'resize', handleResize);
  }, [open, initialInstantTimeout, resizeTimeout, positionerElement]);

  const element = usePositioner(componentProps, state, {
    styles: positioning.positionerStyles,
    transitionStatus,
    props: elementProps,
    refs: [forwardedRef, setPositionerElement, positionerRef],
    hidden: !mounted,
    inert: !open,
  });

  return (
    <NavigationMenuPositionerContext.Provider value={positioning}>
      {element}
    </NavigationMenuPositionerContext.Provider>
  );
});

export interface NavigationMenuPositionerState {
  /**
   * Whether the navigation menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: boolean;
}

export interface NavigationMenuPositionerProps
  extends
    UseAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', NavigationMenuPositionerState> {}

export namespace NavigationMenuPositioner {
  export type State = NavigationMenuPositionerState;
  export type Props = NavigationMenuPositionerProps;
}
