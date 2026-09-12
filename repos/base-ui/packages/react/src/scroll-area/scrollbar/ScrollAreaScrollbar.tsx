'use client';
import * as React from 'react';
import { addEventListener } from '@base-ui/utils/addEventListener';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { contains, getTarget } from '../../floating-ui-react/utils';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { ScrollAreaScrollbarContext } from './ScrollAreaScrollbarContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getOffset } from '../utils/getOffset';
import { ScrollAreaRootCssVars } from '../root/ScrollAreaRootCssVars';
import { ScrollAreaScrollbarCssVars } from './ScrollAreaScrollbarCssVars';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export const ScrollAreaScrollbar = React.forwardRef(function ScrollAreaScrollbar(
  componentProps: ScrollAreaScrollbar.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    orientation = 'vertical',
    keepMounted = false,
    style,
    ...elementProps
  } = componentProps;

  const {
    hovering,
    scrollingX,
    scrollingY,
    hiddenState,
    overflowEdges,
    scrollbarYRef,
    scrollbarXRef,
    viewportRef,
    thumbYRef,
    thumbXRef,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    rootId,
    thumbSize,
    hasMeasuredScrollbar,
  } = useScrollAreaRootContext();

  const state: ScrollAreaScrollbarState = {
    hovering,
    scrolling: {
      horizontal: scrollingX,
      vertical: scrollingY,
    }[orientation],
    orientation,
    hasOverflowX: !hiddenState.x,
    hasOverflowY: !hiddenState.y,
    overflowXStart: overflowEdges.xStart,
    overflowXEnd: overflowEdges.xEnd,
    overflowYStart: overflowEdges.yStart,
    overflowYEnd: overflowEdges.yEnd,
    cornerHidden: hiddenState.corner,
  };

  const direction = useDirection();
  const hideTrackUntilMeasured = !hasMeasuredScrollbar && !keepMounted;
  const isHidden = orientation === 'vertical' ? hiddenState.y : hiddenState.x;
  const shouldRender = keepMounted || !isHidden;

  React.useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const viewportEl = viewportRef.current;
    const scrollbarEl = orientation === 'vertical' ? scrollbarYRef.current : scrollbarXRef.current;

    if (!scrollbarEl) {
      return undefined;
    }

    function handleWheel(event: WheelEvent) {
      if (!viewportEl || !scrollbarEl || event.ctrlKey) {
        return;
      }

      const horizontal = orientation === 'horizontal';
      const scrollProperty = horizontal ? 'scrollLeft' : 'scrollTop';
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (delta === 0) {
        return;
      }

      const maxScroll = horizontal
        ? viewportEl.scrollWidth - viewportEl.clientWidth
        : viewportEl.scrollHeight - viewportEl.clientHeight;
      // RTL horizontal scrolling uses a negative `scrollLeft` range, from 0 to `-maxScroll`.
      const minScroll = horizontal && direction === 'rtl' ? -maxScroll : 0;
      const maxScrollValue = horizontal && direction === 'rtl' ? 0 : maxScroll;
      const scrollValue = viewportEl[scrollProperty];

      // At an edge (or with no overflow), let the wheel event chain to the
      // parent/page instead of swallowing it via `preventDefault`.
      if ((scrollValue <= minScroll && delta < 0) || (scrollValue >= maxScrollValue && delta > 0)) {
        return;
      }

      event.preventDefault();

      viewportEl[scrollProperty] = Math.min(
        maxScrollValue,
        Math.max(minScroll, scrollValue + delta),
      );

      handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });
    }

    return addEventListener(scrollbarEl, 'wheel', handleWheel, { passive: false });
  }, [
    direction,
    handleScroll,
    orientation,
    scrollbarXRef,
    scrollbarYRef,
    shouldRender,
    viewportRef,
  ]);

  const props: HTMLProps = {
    ...(rootId && { 'data-id': `${rootId}-scrollbar` }),
    onPointerDown(event) {
      if (event.button !== 0) {
        return;
      }

      const target = getTarget(event.nativeEvent) as Element | null;
      const thumb = orientation === 'vertical' ? thumbYRef.current : thumbXRef.current;

      // Ignore clicks on thumb, including cases where React retargets the
      // synthetic event to the track host across a shadow boundary.
      if (thumb && contains(thumb, target)) {
        return;
      }

      if (!viewportRef.current) {
        return;
      }

      // Handle Y-axis (vertical) scroll
      if (thumbYRef.current && scrollbarYRef.current && orientation === 'vertical') {
        const thumbYOffset = getOffset(thumbYRef.current, 'margin', 'y');
        const scrollbarYOffset = getOffset(scrollbarYRef.current, 'padding', 'y');
        const thumbHeight = thumbYRef.current.offsetHeight;
        const trackRectY = scrollbarYRef.current.getBoundingClientRect();
        const clickY =
          event.clientY - trackRectY.top - thumbHeight / 2 - scrollbarYOffset + thumbYOffset / 2;

        const scrollableContentHeight = viewportRef.current.scrollHeight;
        const viewportHeight = viewportRef.current.clientHeight;

        const maxThumbOffsetY =
          scrollbarYRef.current.offsetHeight - thumbHeight - scrollbarYOffset - thumbYOffset;
        const scrollRatioY = clickY / maxThumbOffsetY;
        const newScrollTop = scrollRatioY * (scrollableContentHeight - viewportHeight);

        viewportRef.current.scrollTop = newScrollTop;
      }

      if (thumbXRef.current && scrollbarXRef.current && orientation === 'horizontal') {
        const thumbXOffset = getOffset(thumbXRef.current, 'margin', 'x');
        const scrollbarXOffset = getOffset(scrollbarXRef.current, 'padding', 'x');
        const thumbWidth = thumbXRef.current.offsetWidth;
        const trackRectX = scrollbarXRef.current.getBoundingClientRect();
        const clickX =
          event.clientX - trackRectX.left - thumbWidth / 2 - scrollbarXOffset + thumbXOffset / 2;

        const scrollableContentWidth = viewportRef.current.scrollWidth;
        const viewportWidth = viewportRef.current.clientWidth;

        const maxThumbOffsetX =
          scrollbarXRef.current.offsetWidth - thumbWidth - scrollbarXOffset - thumbXOffset;
        const scrollRatioX = clickX / maxThumbOffsetX;

        let newScrollLeft: number;
        if (direction === 'rtl') {
          // In RTL, invert the scroll direction
          newScrollLeft = (1 - scrollRatioX) * (scrollableContentWidth - viewportWidth);

          // Adjust for browsers that use negative scrollLeft in RTL
          if (viewportRef.current.scrollLeft <= 0) {
            newScrollLeft = -newScrollLeft;
          }
        } else {
          newScrollLeft = scrollRatioX * (scrollableContentWidth - viewportWidth);
        }

        viewportRef.current.scrollLeft = newScrollLeft;
      }

      handleScroll({ x: viewportRef.current.scrollLeft, y: viewportRef.current.scrollTop });

      handlePointerDown(event);
    },
    onPointerUp: handlePointerUp,
    // Mirror `onPointerUp` so a browser-cancelled gesture on the track (no thumb
    // child captures the pointer) still clears the drag state.
    onPointerCancel: handlePointerUp,
    style: {
      position: 'absolute',
      touchAction: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      visibility: hideTrackUntilMeasured ? 'hidden' : undefined,
      ...(orientation === 'vertical' && {
        top: 0,
        bottom: `var(${ScrollAreaRootCssVars.scrollAreaCornerHeight})`,
        insetInlineEnd: 0,
        [ScrollAreaScrollbarCssVars.scrollAreaThumbHeight as string]: `${thumbSize.height}px`,
      }),
      ...(orientation === 'horizontal' && {
        insetInlineStart: 0,
        insetInlineEnd: `var(${ScrollAreaRootCssVars.scrollAreaCornerWidth})`,
        bottom: 0,
        [ScrollAreaScrollbarCssVars.scrollAreaThumbWidth as string]: `${thumbSize.width}px`,
      }),
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, orientation === 'vertical' ? scrollbarYRef : scrollbarXRef],
    state,
    props: [props, elementProps],
    stateAttributesMapping: scrollAreaStateAttributesMapping,
  });

  const contextValue = React.useMemo(() => ({ orientation }), [orientation]);

  if (!shouldRender) {
    return null;
  }

  return (
    <ScrollAreaScrollbarContext.Provider value={contextValue}>
      {element}
    </ScrollAreaScrollbarContext.Provider>
  );
});

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: boolean;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The orientation of the scrollbar.
   */
  orientation: 'vertical' | 'horizontal';
}

export interface ScrollAreaScrollbarProps extends BaseUIComponentProps<
  'div',
  ScrollAreaScrollbarState
> {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the viewport isn't scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props = ScrollAreaScrollbarProps;
}
