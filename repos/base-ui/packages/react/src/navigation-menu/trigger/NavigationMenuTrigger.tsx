'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { ownerWindow } from '@base-ui/utils/owner';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { useAnimationFrame } from '@base-ui/utils/useAnimationFrame';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { EMPTY_ARRAY } from '@base-ui/utils/empty';
import {
  safePolygon,
  useClick,
  useFloatingRootContext,
  useFloatingTree,
  useHoverReferenceInteraction,
} from '../../floating-ui-react';
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  useHoverInteractionSharedState,
} from '../../floating-ui-react/hooks/useHoverInteractionSharedState';
import {
  contains,
  getTabbableAfterElement,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
  stopEvent,
} from '../../floating-ui-react/utils';
import type { HandleCloseContextBase } from '../../floating-ui-react/hooks/useHoverShared';
import type { BaseUIComponentProps, NativeButtonProps, HTMLProps } from '../../internals/types';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownerVisuallyHidden, PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { FocusGuard } from '../../utils/FocusGuard';
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useButton } from '../../internals/use-button';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { NavigationMenuRoot } from '../root/NavigationMenuRoot';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';
import { useNavigationMenuDismissContext } from '../list/NavigationMenuDismissContext';
import { NavigationMenuPopupCssVars } from '../popup/NavigationMenuPopupCssVars';
import { NavigationMenuPositionerCssVars } from '../positioner/NavigationMenuPositionerCssVars';
import { mergeProps } from '../../merge-props';
import { useDirection } from '../../internals/direction-context/DirectionContext';

const DEFAULT_SIZE = { width: 0, height: 0 };

/**
 * Opens the navigation menu popup when hovered or clicked, revealing the
 * associated content.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuTrigger = React.forwardRef(function NavigationMenuTrigger(
  componentProps: NavigationMenuTrigger.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  const {
    render,
    className,
    style,
    nativeButton = true,
    disabled,
    ...elementProps
  } = componentProps;

  const {
    value,
    setValue,
    mounted,
    open,
    positionerElement,
    setActivationDirection,
    setFloatingRootContext,
    popupElement,
    viewportElement,
    transitionStatus,
    rootRef,
    beforeOutsideRef,
    afterOutsideRef,
    afterInsideRef,
    beforeInsideRef,
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    currentContentRef,
    delay,
    closeDelay,
    orientation,
    setViewportInert,
    nested,
  } = useNavigationMenuRootContext();
  const { value: itemValue } = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();
  const dismissProps = useNavigationMenuDismissContext();
  const direction = useDirection();

  const stickIfOpenTimeout = useTimeout();
  const focusFrame = useAnimationFrame();
  const mutationFrame = useAnimationFrame();
  const resizeFrame = useAnimationFrame();
  const sizeFrame = useAnimationFrame();

  const [triggerElement, setTriggerElement] = React.useState<HTMLElement | null>(null);
  const [stickIfOpen, setStickIfOpen] = React.useState(true);
  const [pointerType, setPointerType] = React.useState<'mouse' | 'touch' | 'pen' | ''>('');

  const triggerElementRef = React.useRef<HTMLElement | null>(null);
  const allowFocusRef = React.useRef(false);
  const prevSizeRef = React.useRef(DEFAULT_SIZE);
  const skipAutoSizeSyncRef = React.useRef(false);

  const isActiveItem = open && value === itemValue;
  const isActiveItemRef = useValueAsRef(isActiveItem);
  const interactionsEnabled = (positionerElement != null || value == null) && !disabled;
  const hoverFloatingElement = positionerElement || viewportElement;
  const hoverInteractionsEnabled = (hoverFloatingElement != null || value == null) && !disabled;

  const runOnceAnimationsFinish = useAnimationsFinished(popupElement, false, false);

  const handleTriggerElement = React.useCallback((element: HTMLElement | null) => {
    triggerElementRef.current = element;
    setTriggerElement(element);
  }, []);

  const cancelAutoSizeReset = useStableCallback((force = false) => {
    if (!force && popupAutoSizeResetRef.current.owner !== itemValue) {
      return;
    }

    popupAutoSizeResetRef.current.abortController?.abort();
    popupAutoSizeResetRef.current.abortController = null;
    popupAutoSizeResetRef.current.owner = null;
  });

  useIsoLayoutEffect(() => {
    if (isActiveItem) {
      return;
    }

    mutationFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset();
  }, [isActiveItem, mutationFrame, sizeFrame, cancelAutoSizeReset]);

  function setAutoSizes() {
    if (!popupElement) {
      return;
    }

    popupElement.style.setProperty(NavigationMenuPopupCssVars.popupWidth, 'auto');
    popupElement.style.setProperty(NavigationMenuPopupCssVars.popupHeight, 'auto');
  }

  function clearFixedSizes() {
    if (!popupElement || !positionerElement) {
      return;
    }

    popupElement.style.removeProperty(NavigationMenuPopupCssVars.popupWidth);
    popupElement.style.removeProperty(NavigationMenuPopupCssVars.popupHeight);
    positionerElement.style.removeProperty(NavigationMenuPositionerCssVars.positionerWidth);
    positionerElement.style.removeProperty(NavigationMenuPositionerCssVars.positionerHeight);
  }

  function scheduleAutoSizeReset() {
    cancelAutoSizeReset(true);

    const abortController = new AbortController();
    popupAutoSizeResetRef.current.abortController = abortController;
    popupAutoSizeResetRef.current.owner = itemValue;

    runOnceAnimationsFinish(() => {
      if (
        popupAutoSizeResetRef.current.abortController !== abortController ||
        popupAutoSizeResetRef.current.owner !== itemValue
      ) {
        return;
      }

      popupAutoSizeResetRef.current.abortController = null;
      popupAutoSizeResetRef.current.owner = null;
      setAutoSizes();
    }, abortController.signal);
  }

  const handleValueChange = useStableCallback(
    (
      currentWidth: number,
      currentHeight: number,
      options: {
        syncPositioner?: boolean | undefined;
      } = {},
    ) => {
      if (!popupElement || !positionerElement) {
        return;
      }

      cancelAutoSizeReset(true);
      const { syncPositioner = false } = options;

      clearFixedSizes();

      const { width, height } = getCssDimensions(popupElement);
      const measuredWidth = width || prevSizeRef.current.width;
      const measuredHeight = height || prevSizeRef.current.height;

      if (currentHeight === 0 || currentWidth === 0) {
        currentWidth = measuredWidth;
        currentHeight = measuredHeight;
      }

      popupElement.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${currentWidth}px`);
      popupElement.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${currentHeight}px`);
      positionerElement.style.setProperty(
        NavigationMenuPositionerCssVars.positionerWidth,
        `${syncPositioner ? currentWidth : measuredWidth}px`,
      );
      positionerElement.style.setProperty(
        NavigationMenuPositionerCssVars.positionerHeight,
        `${syncPositioner ? currentHeight : measuredHeight}px`,
      );

      sizeFrame.request(() => {
        if (!isActiveItemRef.current) {
          return;
        }

        popupElement.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${measuredWidth}px`);
        popupElement.style.setProperty(
          NavigationMenuPopupCssVars.popupHeight,
          `${measuredHeight}px`,
        );

        if (syncPositioner) {
          positionerElement.style.setProperty(
            NavigationMenuPositionerCssVars.positionerWidth,
            `${measuredWidth}px`,
          );
          positionerElement.style.setProperty(
            NavigationMenuPositionerCssVars.positionerHeight,
            `${measuredHeight}px`,
          );
        }

        scheduleAutoSizeReset();
      });
    },
  );

  const handleInterruptedMutationResize = useStableCallback(
    (currentWidth: number, currentHeight: number) => {
      if (!popupElement || !positionerElement) {
        return;
      }

      sizeFrame.cancel();
      mutationFrame.cancel();
      cancelAutoSizeReset(true);

      if (currentWidth === 0 || currentHeight === 0) {
        return;
      }

      setSharedFixedSize(popupElement, positionerElement, currentWidth, currentHeight);

      mutationFrame.request(() => {
        mutationFrame.request(() => {
          clearFixedSizes();

          const { width, height } = getCssDimensions(popupElement);
          const measuredWidth = width || currentWidth || prevSizeRef.current.width;
          const measuredHeight = height || currentHeight || prevSizeRef.current.height;

          setSharedFixedSize(popupElement, positionerElement, currentWidth, currentHeight);

          sizeFrame.request(() => {
            if (!isActiveItemRef.current) {
              return;
            }

            setSharedFixedSize(popupElement, positionerElement, measuredWidth, measuredHeight);
            scheduleAutoSizeReset();
          });
        });
      });
    },
  );

  const syncCurrentSize = useStableCallback(() => {
    if (!popupElement || !positionerElement) {
      return;
    }

    sizeFrame.cancel();
    cancelAutoSizeReset(true);

    clearFixedSizes();

    const { width, height } = getCssDimensions(popupElement);

    if (width === 0 || height === 0) {
      return;
    }

    prevSizeRef.current = { width, height };
    setAutoSizes();
    positionerElement.style.setProperty(
      NavigationMenuPositionerCssVars.positionerWidth,
      `${width}px`,
    );
    positionerElement.style.setProperty(
      NavigationMenuPositionerCssVars.positionerHeight,
      `${height}px`,
    );
  });

  const getMutationBaseline = useStableCallback(() => {
    if (!popupElement) {
      return { size: prevSizeRef.current, syncPositioner: false };
    }

    const popupWidth = popupElement.style.getPropertyValue(NavigationMenuPopupCssVars.popupWidth);
    const popupHeight = popupElement.style.getPropertyValue(NavigationMenuPopupCssVars.popupHeight);
    const isResizing =
      popupWidth !== '' && popupWidth !== 'auto' && popupHeight !== '' && popupHeight !== 'auto';

    if (!isResizing) {
      return { size: prevSizeRef.current, syncPositioner: false };
    }

    return {
      size: {
        width: popupElement.offsetWidth || prevSizeRef.current.width,
        height: popupElement.offsetHeight || prevSizeRef.current.height,
      },
      syncPositioner: true,
    };
  });

  React.useEffect(() => {
    if (!open) {
      stickIfOpenTimeout.clear();
      mutationFrame.cancel();
      resizeFrame.cancel();
      sizeFrame.cancel();
      cancelAutoSizeReset(true);
      skipAutoSizeSyncRef.current = false;
      setPointerType('');
    }
  }, [stickIfOpenTimeout, open, mutationFrame, resizeFrame, sizeFrame, cancelAutoSizeReset]);

  React.useEffect(() => {
    if (!mounted) {
      prevSizeRef.current = DEFAULT_SIZE;
    }
  }, [mounted]);

  useIsoLayoutEffect(() => {
    if (!popupElement || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      prevSizeRef.current = {
        width: popupElement.offsetWidth,
        height: popupElement.offsetHeight,
      };
    });

    resizeObserver.observe(popupElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [popupElement]);

  React.useEffect(() => {
    if (!open || !isActiveItem || !popupElement || !positionerElement) {
      return undefined;
    }

    const win = ownerWindow(positionerElement);
    function handleResize() {
      resizeFrame.cancel();
      resizeFrame.request(syncCurrentSize);
    }

    const unsubscribe = addEventListener(win, 'resize', handleResize);

    return () => {
      resizeFrame.cancel();
      unsubscribe();
    };
  }, [open, isActiveItem, popupElement, positionerElement, resizeFrame, syncCurrentSize]);

  React.useEffect(() => {
    const observedElement = currentContentRef.current;

    if (
      !observedElement ||
      !popupElement ||
      !isActiveItem ||
      typeof MutationObserver !== 'function'
    ) {
      return undefined;
    }

    const mutationObserver = new MutationObserver(() => {
      if (
        transitionStatus === 'starting' ||
        popupElement.hasAttribute(TransitionStatusDataAttributes.startingStyle)
      ) {
        syncCurrentSize();
        return;
      }

      const { size, syncPositioner } = getMutationBaseline();

      if (syncPositioner) {
        handleInterruptedMutationResize(size.width, size.height);
        return;
      }

      handleValueChange(size.width, size.height);
    });

    mutationObserver.observe(observedElement, {
      childList: true,
      subtree: true,
      characterData: true,
      // `keepMounted` submenu switches update dimensions by toggling hidden
      // content rather than inserting or removing content nodes.
      attributes: true,
      attributeFilter: ['hidden'],
    });

    return () => {
      mutationObserver.disconnect();
    };
  }, [
    currentContentRef,
    popupElement,
    isActiveItem,
    transitionStatus,
    getMutationBaseline,
    handleInterruptedMutationResize,
    handleValueChange,
    syncCurrentSize,
  ]);

  React.useEffect(() => {
    if (isActiveItem && open && popupElement && allowFocusRef.current) {
      allowFocusRef.current = false;
      focusFrame.request(() => {
        beforeOutsideRef.current?.focus();
      });
    }

    return () => {
      focusFrame.cancel();
    };
  }, [beforeOutsideRef, focusFrame, isActiveItem, open, popupElement]);

  useIsoLayoutEffect(() => {
    if (isActiveItemRef.current && open && popupElement) {
      const hasNestedMenu = currentContentRef.current?.querySelector('[data-nested]') != null;

      if (transitionStatus === 'starting' && hasNestedMenu) {
        // Inline nested menus can reveal their default content after the
        // top-level content enters the viewport. Defer once so the opening
        // size is measured from the final nested content, not the shell.
        sizeFrame.request(syncCurrentSize);
        return () => {
          sizeFrame.cancel();
        };
      }

      if (skipAutoSizeSyncRef.current) {
        skipAutoSizeSyncRef.current = false;
        return undefined;
      }

      const { width, height } = getCssDimensions(popupElement);
      handleValueChange(width, height);
    }
    return undefined;
  }, [
    currentContentRef,
    handleValueChange,
    isActiveItemRef,
    open,
    popupElement,
    sizeFrame,
    syncCurrentSize,
    transitionStatus,
  ]);

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails: NavigationMenuRoot.ChangeEventDetails,
  ) {
    const isHover = eventDetails.reason === REASONS.triggerHover;

    if (!interactionsEnabled) {
      return;
    }

    if (pointerType === 'touch' && isHover) {
      return;
    }

    if (!nextOpen && value !== itemValue) {
      return;
    }

    function changeState() {
      if (isHover) {
        // Only allow "patient" clicks to close the popup if it's open.
        // If they clicked within 500ms of the popup opening, keep it open.
        setStickIfOpen(true);
        stickIfOpenTimeout.clear();
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          setStickIfOpen(false);
        });
      }

      if (nextOpen) {
        setValue(itemValue, eventDetails);
      } else {
        setValue(null, eventDetails);
        setPointerType('');
      }
    }

    if (isHover) {
      ReactDOM.flushSync(changeState);
    } else {
      changeState();
    }
  }

  const context = useFloatingRootContext({
    open,
    onOpenChange: handleOpenChange,
    elements: {
      reference: triggerElement,
      floating: hoverFloatingElement,
    },
  });

  const hoverInteractionState = useHoverInteractionSharedState(context);
  const shouldBlockSafePolygonPointerEvents = pointerType !== 'touch';

  React.useEffect(() => {
    if (!open) {
      context.context.dataRef.current.openEvent = undefined;
      hoverInteractionState.pointerType = undefined;
      hoverInteractionState.interactedInside = false;
      hoverInteractionState.restTimeoutPending = false;
      hoverInteractionState.openChangeTimeout.clear();
      hoverInteractionState.restTimeout.clear();
      clearSafePolygonPointerEventsMutation(hoverInteractionState);
    }
  }, [context, hoverInteractionState, open]);

  const getInlineHandleCloseContext = useStableCallback(() => {
    if (!nested || positionerElement || !triggerElementRef.current || !hoverFloatingElement) {
      return null;
    }

    return getHandleCloseContext(triggerElementRef.current, hoverFloatingElement, nodeId);
  });

  function getScope() {
    if (!nested || !positionerElement) {
      return triggerElementRef.current?.closest('ul') ?? null;
    }

    return null;
  }

  const hoverProps = useHoverReferenceInteraction(context, {
    enabled: hoverInteractionsEnabled,
    move: false,
    handleClose: safePolygon({
      blockPointerEvents: shouldBlockSafePolygonPointerEvents,
      getScope,
    }),
    restMs: mounted && positionerElement ? 0 : delay,
    delay: { close: closeDelay },
    triggerElementRef,
    getHandleCloseContext: getInlineHandleCloseContext,
  });

  const hover = React.useMemo(
    () => (hoverProps ? { reference: hoverProps } : undefined),
    [hoverProps],
  );

  const click = useClick(context, {
    enabled: interactionsEnabled,
    stickIfOpen,
    toggle: isActiveItem,
  });
  const referenceProps = React.useMemo(
    () => mergeProps(click.reference, hover?.reference),
    [click.reference, hover],
  );

  useIsoLayoutEffect(() => {
    if (isActiveItem) {
      setFloatingRootContext(context);
      prevTriggerElementRef.current = triggerElement;
    }
  }, [isActiveItem, context, setFloatingRootContext, prevTriggerElementRef, triggerElement]);

  function handleActivation(event: React.MouseEvent | React.KeyboardEvent) {
    ReactDOM.flushSync(() => {
      const currentTarget = isHTMLElement(event.currentTarget) ? event.currentTarget : null;
      const prevTriggerRect = prevTriggerElementRef.current?.getBoundingClientRect();

      if (mounted && prevTriggerRect && triggerElement) {
        const nextTriggerRect = triggerElement.getBoundingClientRect();
        const isMovingRight = nextTriggerRect.left > prevTriggerRect.left;
        const isMovingDown = nextTriggerRect.top > prevTriggerRect.top;

        if (orientation === 'horizontal' && nextTriggerRect.left !== prevTriggerRect.left) {
          setActivationDirection(isMovingRight ? 'right' : 'left');
        } else if (orientation === 'vertical' && nextTriggerRect.top !== prevTriggerRect.top) {
          setActivationDirection(isMovingDown ? 'down' : 'up');
        }
      }

      // Reset the `openEvent` to `undefined` when the active item changes so that a
      // `click` -> `hover` on new trigger -> `hover` back to old trigger doesn't unexpectedly
      // cause the popup to remain stuck open when leaving the old trigger.
      if (event.type !== 'click' && value != null) {
        context.context.dataRef.current.openEvent = undefined;
      }

      if (pointerType === 'touch' && event.type !== 'click') {
        return;
      }

      // Keyboard open events reach this activation path after `onKeyDown` has already set
      // the value with the `listNavigation` reason.
      if (value != null && event.type !== 'keydown') {
        setValue(
          itemValue,
          createChangeEventDetails(
            event.type === 'mouseenter' ? REASONS.triggerHover : REASONS.triggerPress,
            event.nativeEvent,
          ),
        );
      }

      if (
        event.type === 'mouseenter' &&
        shouldBlockSafePolygonPointerEvents &&
        (!nested || !positionerElement) &&
        hoverFloatingElement &&
        currentTarget
      ) {
        const applyPointerEventsMutation = () => {
          const scopeElement = getScope() ?? currentTarget.ownerDocument.body;

          applySafePolygonPointerEventsMutation(hoverInteractionState, {
            scopeElement,
            referenceElement: currentTarget,
            floatingElement: hoverFloatingElement,
          });
        };

        if (value != null && value !== itemValue) {
          queueMicrotask(applyPointerEventsMutation);
        } else {
          applyPointerEventsMutation();
        }
      }
    });
  }

  const handleOpenEvent = useStableCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) {
      return;
    }

    if (!popupElement || !positionerElement) {
      handleActivation(event);
      return;
    }

    const { width, height } = getCssDimensions(popupElement);
    const shouldSkipAutoSizeSync =
      value != null && value !== itemValue && (event.type === 'click' || pointerType !== 'touch');

    handleActivation(event);

    if (shouldSkipAutoSizeSync) {
      skipAutoSizeSyncRef.current = true;
    }

    handleValueChange(width, height);
  });

  const state: NavigationMenuTriggerState = {
    open: isActiveItem,
  };

  function handleSetPointerType(event: React.PointerEvent) {
    setPointerType(event.pointerType);
  }

  function handleTriggerPointerDown(event: React.PointerEvent) {
    handleSetPointerType(event);
    clearSafePolygonPointerEventsMutation(hoverInteractionState);
  }

  const defaultProps: HTMLProps = {
    tabIndex: 0,
    onMouseEnter: handleOpenEvent,
    onClick: handleOpenEvent,
    onPointerEnter: handleSetPointerType,
    onPointerDown: handleTriggerPointerDown,
    'aria-expanded': isActiveItem,
    'aria-controls': isActiveItem ? popupElement?.id : undefined,
    [NAVIGATION_MENU_TRIGGER_IDENTIFIER as string]: '',
    onFocus() {
      if (!isActiveItem) {
        return;
      }
      setViewportInert(false);
    },
    onMouseMove() {
      allowFocusRef.current = false;
    },
    onKeyDown(event) {
      allowFocusRef.current = true;

      // For nested (submenu) triggers, don't intercept arrow keys that are used for
      // navigation in the parent content. The arrow keys should be handled by the
      // parent's CompositeRoot for navigating between items.
      if (nested) {
        return;
      }

      const verticalOpenKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const openHorizontal = orientation === 'horizontal' && event.key === 'ArrowDown';
      const openVertical = orientation === 'vertical' && event.key === verticalOpenKey;

      if (openHorizontal || openVertical) {
        setValue(itemValue, createChangeEventDetails(REASONS.listNavigation, event.nativeEvent));
        handleOpenEvent(event);
        stopEvent(event);
      }
    },
    onBlur(event) {
      if (
        positionerElement &&
        popupElement &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement, rootRef, tree, nodeId },
        )
      ) {
        setValue(null, createChangeEventDetails(REASONS.focusOut, event.nativeEvent));
      }
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
  });

  const referenceElement = hoverFloatingElement;

  return (
    <React.Fragment>
      <CompositeItem
        tag="button"
        render={render}
        className={className}
        style={style}
        state={state}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
        refs={[forwardedRef, handleTriggerElement, buttonRef]}
        props={[
          referenceProps,
          dismissProps?.reference || EMPTY_ARRAY,
          defaultProps,
          elementProps,
          getButtonProps,
        ]}
      />
      {isActiveItem && (
        <React.Fragment>
          <FocusGuard
            ref={beforeOutsideRef}
            onFocus={(event) => {
              if (referenceElement && isOutsideEvent(event, referenceElement)) {
                beforeInsideRef.current?.focus();
              } else {
                const prevTabbable = getPreviousTabbable(triggerElement);
                prevTabbable?.focus();
              }
            }}
          />
          <span aria-owns={viewportElement?.id} style={ownerVisuallyHidden} />
          <FocusGuard
            ref={afterOutsideRef}
            onFocus={(event) => {
              if (referenceElement && isOutsideEvent(event, referenceElement)) {
                ReactDOM.flushSync(() => {
                  setViewportInert(false);
                });
                const elementToFocus = afterInsideRef.current || triggerElement;
                elementToFocus?.focus();
              } else {
                let nextTabbable = getNextTabbable(triggerElement);

                if (
                  nested &&
                  !positionerElement &&
                  referenceElement &&
                  nextTabbable &&
                  contains(referenceElement, nextTabbable)
                ) {
                  nextTabbable = getTabbableAfterElement(afterInsideRef.current);
                }

                nextTabbable?.focus();

                if ((!nested || positionerElement) && !contains(rootRef.current, nextTabbable)) {
                  setValue(null, createChangeEventDetails(REASONS.focusOut, event.nativeEvent));
                }
              }
            }}
          />
        </React.Fragment>
      )}
    </React.Fragment>
  );
});

export interface NavigationMenuTriggerState {
  /**
   * If `true`, the popup is open and the item is active.
   */
  open: boolean;
}

export interface NavigationMenuTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NavigationMenuTriggerState> {}

export namespace NavigationMenuTrigger {
  export type State = NavigationMenuTriggerState;
  export type Props = NavigationMenuTriggerProps;
}

function getPlacementFromElements(
  domReferenceElement: Element,
  floatingElement: HTMLElement,
): HandleCloseContextBase['placement'] {
  const referenceRect = domReferenceElement.getBoundingClientRect();
  const floatingRect = floatingElement.getBoundingClientRect();
  const referenceCenterX = referenceRect.left + referenceRect.width / 2;
  const referenceCenterY = referenceRect.top + referenceRect.height / 2;
  const floatingCenterX = floatingRect.left + floatingRect.width / 2;
  const floatingCenterY = floatingRect.top + floatingRect.height / 2;
  const deltaX = floatingCenterX - referenceCenterX;
  const deltaY = floatingCenterY - referenceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function getHandleCloseContext(
  domReferenceElement: Element,
  floatingElement: HTMLElement,
  nodeId: string | undefined,
): HandleCloseContextBase {
  return {
    placement: getPlacementFromElements(domReferenceElement, floatingElement),
    elements: {
      domReference: domReferenceElement,
      floating: floatingElement,
    },
    nodeId,
  };
}
