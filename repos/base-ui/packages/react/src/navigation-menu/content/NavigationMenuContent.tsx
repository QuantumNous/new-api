'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { inertValue } from '@base-ui/utils/inertValue';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { FloatingNode } from '../../floating-ui-react';
import { contains, getTarget } from '../../floating-ui-react/utils';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { popupStateMapping } from '../../utils/popupStateMapping';

const stateAttributesMapping: StateAttributesMapping<NavigationMenuContentState> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
  activationDirection(value) {
    if (!value) {
      return null;
    }
    return {
      'data-activation-direction': value,
    };
  },
};

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuContent = React.forwardRef(function NavigationMenuContent(
  componentProps: NavigationMenuContent.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, keepMounted = false, ...elementProps } = componentProps;

  const {
    mounted: popupMounted,
    viewportElement,
    value,
    activationDirection,
    currentContentRef,
    viewportTargetElement,
  } = useNavigationMenuRootContext();
  const { value: itemValue } = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();

  const open = popupMounted && value === itemValue;

  const ref = React.useRef<HTMLDivElement | null>(null);

  const [hasMountedInPortal, setHasMountedInPortal] = React.useState(false);
  const [focusInside, setFocusInside] = React.useState(false);

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`.
  if (mounted && !popupMounted) {
    setMounted(false);
  }

  useOpenChangeComplete({
    ref,
    open,
    onComplete() {
      if (!open) {
        setMounted(false);
      }
    },
  });

  // When a content re-enters while still mounted (e.g. switching top-level triggers
  // back before the exit animation completes), the DOM element hasn't changed so the
  // callback ref won't fire again. Ensure the shared ref is updated so the
  // MutationObserver in the trigger watches the correct content element.
  useIsoLayoutEffect(() => {
    if (open && ref.current) {
      currentContentRef.current = ref.current;
    }
  }, [open, currentContentRef]);

  const state: NavigationMenuContentState = {
    open,
    transitionStatus,
    activationDirection,
  };

  const handleCurrentContentRef = useStableCallback((node: HTMLDivElement | null) => {
    // Inactive `keepMounted` content also mounts in the viewport; only the
    // active content can own the shared sizing observer target.
    if (node && open) {
      currentContentRef.current = node;
    }
  });

  const commonProps: HTMLProps<HTMLDivElement> = {
    onFocus(event) {
      const target = getTarget(event.nativeEvent) as Element | null;
      if (target?.hasAttribute('data-base-ui-focus-guard')) {
        return;
      }
      setFocusInside(true);
    },
    onBlur(event) {
      if (!contains(event.currentTarget, event.relatedTarget)) {
        setFocusInside(false);
      }
    },
  };

  const defaultProps: HTMLProps =
    !open && mounted
      ? {
          style: { position: 'absolute', top: 0, left: 0 },
          inert: inertValue(!focusInside),
          ...commonProps,
        }
      : commonProps;

  const portalContainer = viewportTargetElement || viewportElement;
  const hidden = keepMounted && !mounted;
  const shouldRenderInline = keepMounted && !portalContainer && !hasMountedInPortal;

  if (keepMounted && portalContainer && !hasMountedInPortal) {
    setHasMountedInPortal(true);
  }

  if (shouldRenderInline) {
    return (
      <CompositeRoot
        render={render}
        className={className}
        style={style}
        state={state}
        refs={[forwardedRef]}
        props={[defaultProps, { hidden: true }, elementProps]}
        stateAttributesMapping={stateAttributesMapping}
      />
    );
  }

  if (!portalContainer || (!mounted && !keepMounted)) {
    return null;
  }

  return ReactDOM.createPortal(
    <FloatingNode id={nodeId}>
      <CompositeRoot
        render={render}
        className={className}
        style={style}
        state={state}
        refs={[forwardedRef, ref, handleCurrentContentRef]}
        props={[defaultProps, hidden ? { hidden: true } : EMPTY_OBJECT, elementProps]}
        stateAttributesMapping={stateAttributesMapping}
      />
    </FloatingNode>,
    portalContainer,
  );
});

export interface NavigationMenuContentState {
  /**
   * If `true`, the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The direction of the activation.
   */
  activationDirection: 'left' | 'right' | 'up' | 'down' | null;
}

export interface NavigationMenuContentProps extends BaseUIComponentProps<
  'div',
  NavigationMenuContentState
> {
  /**
   * Whether to keep the content mounted in the DOM while the popup is closed.
   * Ensures the content is present during server-side rendering for web crawlers.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace NavigationMenuContent {
  export type State = NavigationMenuContentState;
  export type Props = NavigationMenuContentProps;
}
