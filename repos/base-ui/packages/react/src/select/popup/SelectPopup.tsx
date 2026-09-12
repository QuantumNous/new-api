'use client';
import * as React from 'react';
import { rectToClientRect } from '@floating-ui/utils';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { platform } from '@base-ui/utils/platform';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStore } from '@base-ui/utils/store';
import { useAnimationFrame } from '@base-ui/utils/useAnimationFrame';
import type { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { FloatingFocusManager, platform as floatingPlatform } from '../../floating-ui-react';
import type { ClientRectObject } from '../../floating-ui-react';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectFloatingContext, useSelectRootContext } from '../root/SelectRootContext';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { Side, Align } from '../../utils/useAnchorPositioning';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { styleDisableScrollbar } from '../../utils/styles';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { selectors } from '../store';
import { clearStyles, LIST_FUNCTIONAL_STYLES } from './utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { clamp } from '../../internals/clamp';
import { getMaxScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from '../../utils/scrollEdges';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';

const stateAttributesMapping: StateAttributesMapping<SelectPopupState> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the select list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectPopup = React.forwardRef(function SelectPopup(
  componentProps: SelectPopup.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, finalFocus, ...elementProps } = componentProps;

  const {
    store,
    popupRef,
    onOpenChangeComplete,
    setOpen,
    valueRef,
    firstItemTextRef,
    selectedItemTextRef,
    multiple,
    handleScrollArrowVisibility,
    scrollHandlerRef,
    listRef,
    highlightItemOnHover,
  } = useSelectRootContext();
  const {
    side,
    align,
    alignItemWithTriggerActive,
    isPositioned,
    setControlledAlignItemWithTrigger,
  } = useSelectPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;
  const floatingRootContext = useSelectFloatingContext();
  const direction = useDirection();

  const { nonce, disableStyleElements } = useCSPContext();

  const id = useStore(store, selectors.id);
  const open = useStore(store, selectors.open);
  const openMethod = useStore(store, selectors.openMethod);
  const mounted = useStore(store, selectors.mounted);
  const popupProps = useStore(store, selectors.popupProps);
  const transitionStatus = useStore(store, selectors.transitionStatus);
  const triggerElement = useStore(store, selectors.triggerElement);
  const positionerElement = useStore(store, selectors.positionerElement);
  const listElement = useStore(store, selectors.listElement);

  const reachedMaxHeightRef = React.useRef(false);
  const initialPlacedRef = React.useRef(false);
  const originalPositionerStylesRef = React.useRef<React.CSSProperties>({});

  const scrollArrowFrame = useAnimationFrame();

  const handleScroll = useStableCallback((scroller: HTMLDivElement) => {
    if (!positionerElement || !popupRef.current || !initialPlacedRef.current) {
      return;
    }

    if (reachedMaxHeightRef.current || !alignItemWithTriggerActive) {
      handleScrollArrowVisibility();
      return;
    }

    const isTopPositioned = positionerElement.style.top === '0px';
    const isBottomPositioned = positionerElement.style.bottom === '0px';

    if (!isTopPositioned && !isBottomPositioned) {
      handleScrollArrowVisibility();
      return;
    }

    const scale = getScale(positionerElement);
    const currentHeight = normalizeSize(
      positionerElement.getBoundingClientRect().height,
      'y',
      scale,
    );
    const doc = ownerDocument(positionerElement);
    const win = ownerWindow(positionerElement);
    const positionerStyles = win.getComputedStyle(positionerElement);
    const marginTop = parseFloat(positionerStyles.marginTop);
    const marginBottom = parseFloat(positionerStyles.marginBottom);
    const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(popupRef.current));
    const maxAvailableHeight = Math.min(
      doc.documentElement.clientHeight - marginTop - marginBottom,
      maxPopupHeight,
    );

    const scrollTop = scroller.scrollTop;
    const maxScrollTop = getMaxScrollTop(scroller);

    let nextPositionerHeight = 0;
    let nextScrollTop: number | null = null;
    let setReachedMax = false;
    let scrollToMax = false;

    const setHeight = (height: number) => {
      positionerElement.style.height = `${height}px`;
    };

    const handleSmallDiff = (diff: number, targetScrollTop: number) => {
      const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
      if (heightDelta > 0) {
        // Consume the remaining scroll in height.
        setHeight(currentHeight + heightDelta);
      }
      scroller.scrollTop = targetScrollTop;
      if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
        reachedMaxHeightRef.current = true;
      }
      handleScrollArrowVisibility();
    };

    const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
    const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

    nextPositionerHeight = nextHeight;

    if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
      handleSmallDiff(diff, isTopPositioned ? maxScrollTop : 0);
      return;
    }

    if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
      if (isTopPositioned) {
        scrollToMax = true;
      } else {
        nextScrollTop = 0;
      }
    } else {
      setReachedMax = true;

      if (isBottomPositioned && scrollTop < maxScrollTop) {
        const overshoot = currentHeight + diff - maxAvailableHeight;
        nextScrollTop = scrollTop - (diff - overshoot);
      }
    }

    nextPositionerHeight = Math.ceil(nextPositionerHeight);

    if (nextPositionerHeight !== 0) {
      setHeight(nextPositionerHeight);
    }

    if (scrollToMax || nextScrollTop != null) {
      // Recompute bounds after resizing (clientHeight likely changed).
      const nextMaxScrollTop = getMaxScrollTop(scroller);

      const target = scrollToMax ? nextMaxScrollTop : clamp(nextScrollTop!, 0, nextMaxScrollTop);

      // Avoid adjustments that re-trigger scroll events forever.
      if (Math.abs(scroller.scrollTop - target) > SCROLL_EDGE_TOLERANCE_PX) {
        scroller.scrollTop = target;
      }
    }

    if (setReachedMax || nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeightRef.current = true;
    }

    handleScrollArrowVisibility();
  });

  React.useImperativeHandle(scrollHandlerRef, () => handleScroll, [handleScroll]);

  useOpenChangeComplete({
    open,
    ref: popupRef,
    onComplete() {
      if (open) {
        onOpenChangeComplete?.(true);
      }
    },
  });

  const state: SelectPopupState = {
    open,
    transitionStatus,
    side,
    align,
  };

  useIsoLayoutEffect(() => {
    if (
      !positionerElement ||
      !popupRef.current ||
      Object.keys(originalPositionerStylesRef.current).length
    ) {
      return;
    }

    originalPositionerStylesRef.current = {
      top: positionerElement.style.top || '0',
      left: positionerElement.style.left || '0',
      right: positionerElement.style.right,
      height: positionerElement.style.height,
      bottom: positionerElement.style.bottom,
      minHeight: positionerElement.style.minHeight,
      maxHeight: positionerElement.style.maxHeight,
      marginTop: positionerElement.style.marginTop,
      marginBottom: positionerElement.style.marginBottom,
    };
  }, [popupRef, positionerElement]);

  useIsoLayoutEffect(() => {
    if (open || alignItemWithTriggerActive) {
      return;
    }

    initialPlacedRef.current = false;
    reachedMaxHeightRef.current = false;
    clearStyles(positionerElement, originalPositionerStylesRef.current);
  }, [open, alignItemWithTriggerActive, positionerElement, popupRef]);

  useIsoLayoutEffect(() => {
    const popupElement = popupRef.current;

    // Wait for Floating UI's first positioning pass before reading DOM geometry.
    // We replace the final coordinates for aligned selects, but still need middleware
    // like `size()` to set CSS variables such as `--anchor-width`.
    if (
      !open ||
      !triggerElement ||
      !positionerElement ||
      !popupElement ||
      (alignItemWithTriggerActive && !isPositioned) ||
      store.state.transitionStatus === 'ending'
    ) {
      return;
    }

    if (!alignItemWithTriggerActive) {
      initialPlacedRef.current = true;
      scrollArrowFrame.request(handleScrollArrowVisibility);
      popupElement.style.removeProperty('--transform-origin');
      return;
    }

    // Ensure we remove any transforms that can affect the location of the popup
    // and therefore the calculations.
    const restoreTransformStyles = unsetTransformStyles(popupElement);
    popupElement.style.removeProperty('--transform-origin');

    try {
      let textElement = selectedItemTextRef.current;

      if (!textElement?.isConnected) {
        const hasSelectedValue = selectors.hasSelectedValue(store.state);
        textElement =
          !hasSelectedValue && firstItemTextRef.current?.isConnected
            ? firstItemTextRef.current
            : null;
      }

      const valueElement = valueRef.current;

      const win = ownerWindow(positionerElement);
      const positionerStyles = win.getComputedStyle(positionerElement);
      const popupStyles = win.getComputedStyle(popupElement);

      const doc = ownerDocument(triggerElement);
      const scale = getScale(triggerElement);
      const triggerRect = normalizeRect(triggerElement.getBoundingClientRect(), scale);

      const positionerRect = normalizeRect(positionerElement.getBoundingClientRect(), scale);
      const triggerHeight = triggerRect.height;
      const scroller = listElement || popupElement;
      const scrollHeight = scroller.scrollHeight;

      const borderBottom = parseFloat(popupStyles.borderBottomWidth);
      // The `|| N` fallbacks cover an unset/`auto` value (parses to `NaN`). Note a literal `0`
      // also resolves to the fallback, so an explicit `margin: 0` or `min-height: 0` still takes
      // the default below.
      const marginTop = parseFloat(positionerStyles.marginTop) || 10;
      const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
      const minHeight = parseFloat(positionerStyles.minHeight) || 100;
      const maxPopupHeight = getMaxPopupHeight(popupStyles);

      const paddingLeft = 5;
      const paddingRight = 5;
      const triggerCollisionThreshold = 20;

      const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
      const viewportWidth = doc.documentElement.clientWidth;
      const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;

      let textRect: ClientRectObject | undefined;
      let alignedLeft =
        direction === 'rtl' ? triggerRect.right - positionerRect.width : triggerRect.left;
      let offsetY = 0;

      if (textElement && valueElement) {
        const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
        textRect = normalizeRect(textElement.getBoundingClientRect(), scale);

        alignedLeft =
          positionerRect.left +
          (direction === 'rtl' ? valueRect.right - textRect.right : valueRect.left - textRect.left);
        const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
        const textCenterFromPositionerTop = textRect.top - positionerRect.top + textRect.height / 2;

        offsetY = textCenterFromPositionerTop - valueCenterFromTriggerTop;
      }

      const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
      let height = Math.min(viewportHeight, idealHeight);
      const maxHeight = viewportHeight - marginTop - marginBottom;
      const scrollTop = idealHeight - height;

      const maxRight = viewportWidth - paddingRight;

      positionerElement.style.left = `${clamp(
        alignedLeft,
        paddingLeft,
        maxRight - positionerRect.width,
      )}px`;
      positionerElement.style.height = `${height}px`;
      // `none` (not the invalid `auto`) so the explicit height governs in align mode and isn't
      // clamped by a `max-height` from user CSS.
      positionerElement.style.maxHeight = 'none';
      positionerElement.style.marginTop = `${marginTop}px`;
      positionerElement.style.marginBottom = `${marginBottom}px`;
      popupElement.style.height = '100%';

      const maxScrollTop = getMaxScrollTop(scroller);
      const isTopPositioned = scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;

      if (isTopPositioned) {
        height = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
      }

      // When the trigger is too close to the top or bottom of the viewport, or the minHeight is
      // reached, we fallback to aligning the popup to the trigger as the UX is poor otherwise.
      const fallbackToAlignPopupToTrigger =
        triggerRect.top < triggerCollisionThreshold ||
        triggerRect.bottom > viewportHeight - triggerCollisionThreshold ||
        Math.ceil(height) + SCROLL_EDGE_TOLERANCE_PX < Math.min(scrollHeight, minHeight);

      // Safari doesn't position the popup correctly when pinch-zoomed.
      const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && platform.engine.webkit;

      if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
        initialPlacedRef.current = true;
        clearStyles(positionerElement, originalPositionerStylesRef.current);
        setControlledAlignItemWithTrigger(false);
        return;
      }

      const initialHeight = Math.max(minHeight, height);

      if (isTopPositioned) {
        const topOffset = Math.max(0, viewportHeight - idealHeight);
        positionerElement.style.top = positionerRect.height >= maxHeight ? '0' : `${topOffset}px`;
        positionerElement.style.height = `${height}px`;
        scroller.scrollTop = getMaxScrollTop(scroller);
      } else {
        positionerElement.style.bottom = '0';
        scroller.scrollTop = scrollTop;
      }

      if (textRect) {
        const popupTop = positionerRect.top;
        const popupHeight = positionerRect.height;
        const textCenterY = textRect.top + textRect.height / 2;

        const transformOriginY =
          popupHeight > 0 ? ((textCenterY - popupTop) / popupHeight) * 100 : 50;

        const clampedY = clamp(transformOriginY, 0, 100);

        popupElement.style.setProperty('--transform-origin', `50% ${clampedY}%`);
      }

      if (initialHeight === viewportHeight || height >= maxPopupHeight) {
        reachedMaxHeightRef.current = true;
      }

      handleScrollArrowVisibility();

      if (
        highlightItemOnHover &&
        store.state.selectedIndex === null &&
        store.state.activeIndex === null &&
        listRef.current[0] != null
      ) {
        store.set('activeIndex', 0);
      }

      initialPlacedRef.current = true;
    } finally {
      restoreTransformStyles();
    }
  }, [
    store,
    open,
    positionerElement,
    triggerElement,
    valueRef,
    firstItemTextRef,
    selectedItemTextRef,
    popupRef,
    handleScrollArrowVisibility,
    alignItemWithTriggerActive,
    setControlledAlignItemWithTrigger,
    scrollArrowFrame,
    listElement,
    listRef,
    highlightItemOnHover,
    direction,
    isPositioned,
  ]);

  React.useEffect(() => {
    if (!alignItemWithTriggerActive || !positionerElement || !open) {
      return undefined;
    }

    const win = ownerWindow(positionerElement);

    function handleResize(event: UIEvent) {
      setOpen(false, createChangeEventDetails(REASONS.windowResize, event));
    }

    return addEventListener(win, 'resize', handleResize);
  }, [setOpen, alignItemWithTriggerActive, positionerElement, open]);

  const defaultProps: HTMLProps = {
    ...(listElement
      ? {
          role: 'presentation',
          'aria-orientation': undefined,
        }
      : {
          role: 'listbox',
          'aria-multiselectable': multiple || undefined,
          id: `${id}-list`,
        }),
    onKeyDown(event) {
      if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
    },
    onScroll(event) {
      if (listElement) {
        return;
      }
      handleScroll(event.currentTarget);
    },
    ...(alignItemWithTriggerActive && {
      style: listElement ? { height: '100%' } : LIST_FUNCTIONAL_STYLES,
    }),
  };

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, popupRef],
    state,
    stateAttributesMapping,
    props: [
      popupProps,
      defaultProps,
      getDisabledMountTransitionStyles(transitionStatus),
      {
        className:
          !listElement && alignItemWithTriggerActive ? styleDisableScrollbar.className : undefined,
      },
      elementProps,
    ],
  });

  return (
    <React.Fragment>
      {!disableStyleElements && styleDisableScrollbar.getElement(nonce)}
      <FloatingFocusManager
        context={floatingRootContext}
        modal={false}
        disabled={!mounted}
        openInteractionType={openMethod}
        returnFocus={finalFocus}
        restoreFocus
      >
        {element}
      </FloatingFocusManager>
    </React.Fragment>
  );
});

export interface SelectPopupProps extends BaseUIComponentProps<'div', SelectPopupState> {
  children?: React.ReactNode;
  /**
   * Determines the element to focus when the select popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | React.RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface SelectPopupState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace SelectPopup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

function getMaxPopupHeight(popupStyles: CSSStyleDeclaration) {
  const maxHeightStyle = popupStyles.maxHeight || '';
  return maxHeightStyle.endsWith('px') ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}

function getMaxScrollTop(scroller: HTMLElement) {
  return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}

function getScale(element: HTMLElement) {
  // The platform API is async-capable, but the DOM platform returns a plain scale object.
  return floatingPlatform.getScale(element) as { x: number; y: number };
}

function normalizeSize(size: number, axis: 'x' | 'y', scale: { x: number; y: number }) {
  return size / scale[axis];
}

function normalizeRect(
  rect: DOMRect | DOMRectReadOnly,
  scale: { x: number; y: number },
): ClientRectObject {
  return rectToClientRect({
    x: normalizeSize(rect.x, 'x', scale),
    y: normalizeSize(rect.y, 'y', scale),
    width: normalizeSize(rect.width, 'x', scale),
    height: normalizeSize(rect.height, 'y', scale),
  });
}

const TRANSFORM_STYLE_RESETS = [
  ['transform', 'none'],
  ['scale', '1'],
  ['translate', '0 0'],
] as const;

type TransformStyleProperty = (typeof TRANSFORM_STYLE_RESETS)[number][0];

function unsetTransformStyles(popupElement: HTMLElement) {
  const { style } = popupElement;
  const originalStyles = {} as Record<TransformStyleProperty, string>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = style.getPropertyValue(property);
    style.setProperty(property, value, 'important');
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const originalValue = originalStyles[property];
      if (originalValue) {
        style.setProperty(property, originalValue);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
