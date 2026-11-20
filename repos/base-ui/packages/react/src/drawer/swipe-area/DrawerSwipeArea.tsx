'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  getDisplacement,
  getElementTransform,
  useSwipeDismiss,
  type SwipeDirection,
} from '../../utils/useSwipeDismiss';
import { DrawerPopupCssVars } from '../popup/DrawerPopupCssVars';
import { DrawerPopupDataAttributes } from '../popup/DrawerPopupDataAttributes';
import { DrawerBackdropCssVars } from '../backdrop/DrawerBackdropCssVars';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useTriggerRegistration } from '../../utils/popups';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { DrawerSwipeAreaDataAttributes } from './DrawerSwipeAreaDataAttributes';

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const SWIPE_AREA_OPEN_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.open]: '',
};

const SWIPE_AREA_CLOSED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.closed]: '',
};

const SWIPE_AREA_SWIPING_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.swiping]: '',
};

const SWIPE_AREA_DISABLED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.disabled]: '',
};

const stateAttributesMapping: StateAttributesMapping<DrawerSwipeAreaState> = {
  open(value) {
    return value ? SWIPE_AREA_OPEN_HOOK : SWIPE_AREA_CLOSED_HOOK;
  },
  swiping(value) {
    return value ? SWIPE_AREA_SWIPING_HOOK : null;
  },
  swipeDirection(value) {
    return value ? { [DrawerSwipeAreaDataAttributes.swipeDirection]: value } : null;
  },
  disabled(value) {
    return value ? SWIPE_AREA_DISABLED_HOOK : null;
  },
};

const oppositeSwipeDirection: Record<DrawerSwipeDirection, DrawerSwipeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function resolveTouchAction(direction: DrawerSwipeDirection) {
  return direction === 'left' || direction === 'right' ? 'pan-y' : 'pan-x';
}

/**
 * An invisible area that listens for swipe gestures to open the drawer.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export const DrawerSwipeArea = React.forwardRef(function DrawerSwipeArea(
  componentProps: DrawerSwipeArea.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    style,
    disabled = false,
    swipeDirection: swipeDirectionProp,
    ...elementProps
  } = componentProps;

  const { store } = useDialogRootContext();
  const { swipeDirection, frontmostHeight } = useDrawerRootContext();
  const providerContext = useDrawerProviderContext(true);

  const [swipeActive, setSwipeActive] = React.useState(false);

  const releaseDismissTimeout = useTimeout();
  const swipeAreaRef = React.useRef<HTMLDivElement>(null);
  const swipeStartEventRef = React.useRef<PointerEvent | TouchEvent | null>(null);
  const openedBySwipeRef = React.useRef(false);
  const dragDeltaRef = React.useRef({ x: 0, y: 0 });
  const closedOffsetRef = React.useRef<number | null>(null);
  const appliedSwipeStylesRef = React.useRef(false);
  const popupTransitionRef = React.useRef<string | null>(null);

  const swipeAreaId = useBaseUiId(componentProps.id);
  const registerTrigger = useTriggerRegistration(swipeAreaId, store);

  const open = store.useState('open');

  const resetDragDelta = useStableCallback(() => {
    dragDeltaRef.current.x = 0;
    dragDeltaRef.current.y = 0;
  });

  const resolvedSwipeDirection = swipeDirectionProp ?? oppositeSwipeDirection[swipeDirection];
  const dismissDirection = oppositeSwipeDirection[resolvedSwipeDirection];
  const enabled = !disabled && (!open || swipeActive);

  function disableDismissForSwipe() {
    releaseDismissTimeout.clear();
    store.context.outsidePressEnabledRef.current = false;
  }

  function enableDismissAfterRelease() {
    // Safari can dispatch outside-press for the same swipe-open gesture
    // after release, so defer re-enabling dismissal to the next macrotask.
    releaseDismissTimeout.start(0, () => {
      store.context.outsidePressEnabledRef.current = true;
    });
  }

  function resolvePopupSize() {
    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return null;
    }

    const isHorizontal = dismissDirection === 'left' || dismissDirection === 'right';
    const size = isHorizontal ? popupElement.offsetWidth : popupElement.offsetHeight;
    if (size <= 0) {
      return null;
    }

    return size;
  }

  function resolveClosedOffset() {
    const offset = resolvePopupSize();
    if (offset == null) {
      return null;
    }

    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return offset;
    }

    const isHorizontal = dismissDirection === 'left' || dismissDirection === 'right';
    const transform = getElementTransform(popupElement);
    const transformOffset = isHorizontal ? transform.x : transform.y;
    if (Number.isFinite(transformOffset) && Math.abs(transformOffset) > 0.5) {
      return Math.min(offset, Math.abs(transformOffset));
    }

    return offset;
  }

  function resolveSwipeOpenThreshold() {
    const popupSize = resolvePopupSize();
    if (popupSize == null) {
      return FALLBACK_SWIPE_OPEN_THRESHOLD;
    }

    return popupSize * DEFAULT_SWIPE_OPEN_RATIO;
  }

  function applySwipeMovement() {
    if (!swipeActive) {
      return;
    }

    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return;
    }

    if (!store.select('open') || !store.select('mounted')) {
      return;
    }

    if (closedOffsetRef.current == null) {
      closedOffsetRef.current = resolveClosedOffset();
    }

    const closedOffset = closedOffsetRef.current;
    if (!closedOffset || !Number.isFinite(closedOffset) || closedOffset <= 0) {
      return;
    }

    const { x, y } = dragDeltaRef.current;
    const displacement = getDisplacement(resolvedSwipeDirection, x, y);
    const clampedDisplacement = Math.max(0, displacement);
    const dampedDisplacement =
      clampedDisplacement > closedOffset
        ? closedOffset + Math.sqrt(clampedDisplacement - closedOffset)
        : clampedDisplacement;
    const remaining = closedOffset - dampedDisplacement;
    const directionSign = dismissDirection === 'left' || dismissDirection === 'up' ? -1 : 1;
    const movement = remaining * directionSign;
    const isHorizontal = dismissDirection === 'left' || dismissDirection === 'right';
    const movementX = isHorizontal ? movement : 0;
    const movementY = isHorizontal ? 0 : movement;
    const openProgress = Math.max(0, Math.min(1, clampedDisplacement / closedOffset));
    const backdropProgress = Math.max(0, Math.min(1, 1 - openProgress));

    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementX, `${movementX}px`);
    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementY, `${movementY}px`);
    popupElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
    if (popupTransitionRef.current === null) {
      popupTransitionRef.current = popupElement.style.transition;
    }
    popupElement.style.transition = 'none';

    const backdropElement = store.context.backdropRef.current;
    if (backdropElement) {
      backdropElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${backdropProgress}`);
      if (openProgress > 0 && frontmostHeight > 0) {
        backdropElement.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
      } else {
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }
    }

    providerContext?.visualStateStore.set({
      swipeProgress: openProgress,
      frontmostHeight: openProgress > 0 ? frontmostHeight : 0,
    });
    appliedSwipeStylesRef.current = true;
  }

  const clearSwipeStyles = useStableCallback(() => {
    const popupElement = store.context.popupRef.current;
    if (popupElement && appliedSwipeStylesRef.current) {
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementX);
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementY);
      popupElement.removeAttribute(DrawerPopupDataAttributes.swiping);
    }

    if (popupElement && popupTransitionRef.current !== null) {
      popupElement.style.transition = popupTransitionRef.current;
      popupTransitionRef.current = null;
    }

    const backdropElement = store.context.backdropRef.current;
    if (backdropElement) {
      backdropElement.removeAttribute(DrawerPopupDataAttributes.swiping);
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }

    providerContext?.visualStateStore.set({ swipeProgress: 0, frontmostHeight: 0 });
    appliedSwipeStylesRef.current = false;
  });

  function openDrawer(event?: PointerEvent | TouchEvent) {
    if (store.select('open')) {
      return;
    }
    openedBySwipeRef.current = true;
    store.setOpen(
      true,
      createChangeEventDetails(REASONS.swipe, event, swipeAreaRef.current ?? undefined),
    );
  }

  function closeDrawer(event?: PointerEvent | TouchEvent) {
    if (!store.select('open')) {
      return;
    }
    store.setOpen(
      false,
      createChangeEventDetails(REASONS.swipe, event, swipeAreaRef.current ?? undefined),
    );
  }

  function resetSwipeInteractionState() {
    swipeStartEventRef.current = null;
    openedBySwipeRef.current = false;
    closedOffsetRef.current = null;
    setSwipeActive(false);
  }

  function finishSwipeInteraction() {
    resetSwipeInteractionState();
    enableDismissAfterRelease();
    resetDragDelta();
    clearSwipeStyles();
  }

  const swipe = useSwipeDismiss({
    enabled,
    directions: [resolvedSwipeDirection],
    elementRef: swipeAreaRef,
    trackDrag: false,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      disableDismissForSwipe();
      swipeStartEventRef.current = event;
      openedBySwipeRef.current = false;
      setSwipeActive(true);
      resetDragDelta();
    },
    onProgress(_progress, details) {
      if (!details) {
        return;
      }

      if (!swipeStartEventRef.current) {
        return;
      }

      dragDeltaRef.current.x = details.deltaX;
      dragDeltaRef.current.y = details.deltaY;

      if (details.direction !== resolvedSwipeDirection) {
        return;
      }

      const displacement = getDisplacement(resolvedSwipeDirection, details.deltaX, details.deltaY);

      if (displacement < MIN_SWIPE_START_DISTANCE && !openedBySwipeRef.current) {
        return;
      }

      if (!openedBySwipeRef.current) {
        openDrawer(swipeStartEventRef.current);
      }

      applySwipeMovement();
    },
    onRelease({ event, direction, deltaX, deltaY, releaseVelocityX, releaseVelocityY }) {
      const displacement = getDisplacement(resolvedSwipeDirection, deltaX, deltaY);
      const releaseVelocity = getDisplacement(
        resolvedSwipeDirection,
        releaseVelocityX,
        releaseVelocityY,
      );
      const threshold = resolveSwipeOpenThreshold();
      const hasEnoughDistance = threshold != null && displacement >= threshold;
      const hasEnoughVelocity = releaseVelocity >= VELOCITY_THRESHOLD;
      const shouldOpen =
        threshold != null &&
        direction === resolvedSwipeDirection &&
        (hasEnoughDistance || hasEnoughVelocity) &&
        !disabled;

      if (shouldOpen) {
        if (!store.select('open')) {
          openDrawer(event);
        }
      } else if (openedBySwipeRef.current) {
        closeDrawer(event);
      }

      finishSwipeInteraction();

      return false;
    },
    onCancel: finishSwipeInteraction,
  });

  const swipePointerProps = swipe.getPointerProps();
  const swipeTouchProps = swipe.getTouchProps();
  const resetSwipe = swipe.reset;

  React.useEffect(() => {
    if (!enabled) {
      resetSwipe();
      resetDragDelta();
      clearSwipeStyles();
      resetSwipeInteractionState();
    }
  }, [clearSwipeStyles, enabled, resetDragDelta, resetSwipe]);

  React.useEffect(() => {
    return () => {
      store.context.outsidePressEnabledRef.current = true;
    };
  }, [store]);

  const state: DrawerSwipeAreaState = {
    open,
    swiping: swipe.swiping,
    swipeDirection: resolvedSwipeDirection,
    disabled,
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef, swipeAreaRef, registerTrigger],
    stateAttributesMapping,
    props: [
      {
        role: 'presentation',
        'aria-hidden': true,
        style: {
          pointerEvents: !enabled ? 'none' : undefined,
          touchAction: resolveTouchAction(resolvedSwipeDirection),
        },
        onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerDown?.(event);

          // Prevent native text selection/drag gestures from competing with swipe-open dragging.
          if (event.cancelable) {
            event.preventDefault();
          }
        },
        onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerMove?.(event);
        },
        onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerUp?.(event);
        },
        onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
          if (event.pointerType === 'touch') {
            return;
          }
          swipePointerProps.onPointerCancel?.(event);
        },
      },
      swipeTouchProps,
      swipeAreaId ? { id: swipeAreaId } : undefined,
      elementProps,
    ],
  });
});

export interface DrawerSwipeAreaProps extends BaseUIComponentProps<'div', DrawerSwipeAreaState> {
  /**
   * Whether the swipe area is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The swipe direction that opens the drawer.
   * Defaults to the opposite of `Drawer.Root` `swipeDirection`.
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
}

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: boolean;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: SwipeDirection;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: boolean;
}

export namespace DrawerSwipeArea {
  export type Props = DrawerSwipeAreaProps;
  export type State = DrawerSwipeAreaState;
}
