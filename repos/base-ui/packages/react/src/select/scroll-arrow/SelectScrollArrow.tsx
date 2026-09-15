'use client';
import * as React from 'react';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { useStore } from '@base-ui/utils/store';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { Side } from '../../utils/useAnchorPositioning';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import {
  getMaxScrollOffset,
  normalizeScrollOffset,
  SCROLL_EDGE_TOLERANCE_PX,
} from '../../utils/scrollEdges';
import { selectors } from '../store';

/**
 * @internal
 */
export const SelectScrollArrow = React.forwardRef(function SelectScrollArrow(
  componentProps: SelectScrollArrow.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    style,
    direction,
    keepMounted = false,
    ...elementProps
  } = componentProps;

  const isUp = direction === 'up';

  const { store, popupRef, listRef, handleScrollArrowVisibility, scrollArrowsMountedCountRef } =
    useSelectRootContext();
  const { side, scrollDownArrowRef, scrollUpArrowRef } = useSelectPositionerContext();

  const visibleSelector = isUp ? selectors.scrollUpArrowVisible : selectors.scrollDownArrowVisible;

  const stateVisible = useStore(store, visibleSelector);
  const openMethod = useStore(store, selectors.openMethod);

  // Scroll arrows are disabled for touch modality as they are a hover-only element.
  const visible = stateVisible && openMethod !== 'touch';

  const timeout = useTimeout();

  const scrollArrowRef = isUp ? scrollUpArrowRef : scrollDownArrowRef;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(visible);

  useIsoLayoutEffect(() => {
    scrollArrowsMountedCountRef.current += 1;
    if (!store.state.hasScrollArrows) {
      store.set('hasScrollArrows', true);
    }

    return () => {
      scrollArrowsMountedCountRef.current = Math.max(0, scrollArrowsMountedCountRef.current - 1);
      if (scrollArrowsMountedCountRef.current === 0 && store.state.hasScrollArrows) {
        store.set('hasScrollArrows', false);
      }
    };
  }, [store, scrollArrowsMountedCountRef]);

  useOpenChangeComplete({
    open: visible,
    ref: scrollArrowRef,
    onComplete() {
      if (!visible) {
        setMounted(false);
      }
    },
  });

  const state: SelectScrollArrowState = {
    direction,
    visible,
    side,
    transitionStatus,
  };

  const defaultProps: React.ComponentProps<'div'> = {
    'aria-hidden': true,
    children: isUp ? '▲' : '▼',
    style: {
      position: 'absolute',
    },
    onMouseMove(event) {
      if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
        return;
      }

      store.set('activeIndex', null);

      function scrollNextItem() {
        const scroller = store.state.listElement ?? popupRef.current;
        if (!scroller) {
          return;
        }

        store.set('activeIndex', null);
        handleScrollArrowVisibility();

        const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
        const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
        const isScrolledToEdge = scrollTop === (isUp ? 0 : maxScrollTop);
        const items = listRef.current;

        if (scrollTop !== scroller.scrollTop) {
          scroller.scrollTop = scrollTop;
        }

        // Fallback when there are no items registered yet.
        if (items.length === 0) {
          store.set(isUp ? 'scrollUpArrowVisible' : 'scrollDownArrowVisible', !isScrolledToEdge);
        }

        if (isScrolledToEdge) {
          timeout.clear();
          return;
        }

        if (items.length > 0) {
          const scrollArrowHeight = scrollArrowRef.current?.offsetHeight || 0;
          scroller.scrollTop = getTargetScrollTop(
            items,
            isUp,
            scrollTop,
            scroller.clientHeight,
            scrollArrowHeight,
            maxScrollTop,
          );
        }

        timeout.start(40, scrollNextItem);
      }

      timeout.start(40, scrollNextItem);
    },
    onMouseLeave() {
      timeout.clear();
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, scrollArrowRef],
    state,
    props: [defaultProps, elementProps],
    stateAttributesMapping: transitionStatusMapping,
  });

  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }

  return element;
});

export interface SelectScrollArrowState {
  /**
   * The direction of the element.
   */
  direction: 'up' | 'down';
  /**
   * Whether the element is visible.
   */
  visible: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectScrollArrowProps extends BaseUIComponentProps<
  'div',
  SelectScrollArrowState
> {
  direction: 'up' | 'down';
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectScrollArrow {
  export type State = SelectScrollArrowState;
  export type Props = SelectScrollArrowProps;
}

function getTargetScrollTop(
  items: Array<HTMLElement | null>,
  isUp: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollArrowHeight: number,
  maxScrollTop: number,
) {
  if (isUp) {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }

    const targetIndex = Math.max(0, firstVisibleIndex - 1);
    const targetItem = items[targetIndex];
    return targetIndex < firstVisibleIndex && targetItem
      ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop)
      : 0;
  }

  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }

  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem
    ? normalizeScrollOffset(
        targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight,
        maxScrollTop,
      )
    : maxScrollTop;
}
