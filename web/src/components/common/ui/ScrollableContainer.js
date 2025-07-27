/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef
} from 'react';

/**
 * ScrollableContainer 可滚动容器组件
 * 
 * 提供自动检测滚动状态和显示渐变指示器的功能
 * 当内容超出容器高度且未滚动到底部时，会显示底部渐变指示器
 * 
 */
const ScrollableContainer = forwardRef(({
  children,
  maxHeight = '24rem',
  className = '',
  contentClassName = 'p-2',
  fadeIndicatorClassName = '',
  checkInterval = 100,
  scrollThreshold = 5,
  debounceDelay = 16, // ~60fps
  onScroll,
  onScrollStateChange,
  ...props
}, ref) => {
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const onScrollStateChangeRef = useRef(onScrollStateChange);
  const onScrollRef = useRef(onScroll);

  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    onScrollStateChangeRef.current = onScrollStateChange;
  }, [onScrollStateChange]);

  useEffect(() => {
    onScrollRef.current = onScroll;
  }, [onScroll]);

  const debounce = useCallback((func, delay) => {
    return (...args) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => func(...args), delay);
    };
  }, []);

  const checkScrollable = useCallback(() => {
    if (!scrollRef.current) return;

    const element = scrollRef.current;
    const isScrollable = element.scrollHeight > element.clientHeight;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - scrollThreshold;
    const shouldShowHint = isScrollable && !isAtBottom;

    setShowScrollHint(shouldShowHint);

    if (onScrollStateChangeRef.current) {
      onScrollStateChangeRef.current({
        isScrollable,
        isAtBottom,
        showScrollHint: shouldShowHint,
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      });
    }
  }, [scrollThreshold]);

  const debouncedCheckScrollable = useMemo(() =>
    debounce(checkScrollable, debounceDelay),
    [debounce, checkScrollable, debounceDelay]
  );

  const handleScroll = useCallback((e) => {
    debouncedCheckScrollable();
    if (onScrollRef.current) {
      onScrollRef.current(e);
    }
  }, [debouncedCheckScrollable]);

  useImperativeHandle(ref, () => ({
    checkScrollable: () => {
      checkScrollable();
    },
    scrollToTop: () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    },
    scrollToBottom: () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    },
    getScrollInfo: () => {
      if (!scrollRef.current) return null;
      const element = scrollRef.current;
      return {
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        isScrollable: element.scrollHeight > element.clientHeight,
        isAtBottom: element.scrollTop + element.clientHeight >= element.scrollHeight - scrollThreshold
      };
    }
  }), [checkScrollable, scrollThreshold]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkScrollable();
    }, checkInterval);
    return () => clearTimeout(timer);
  }, [checkScrollable, checkInterval]);

  useEffect(() => {
    if (!scrollRef.current) return;

    if (typeof ResizeObserver === 'undefined') {
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => {
          debouncedCheckScrollable();
        });

        observer.observe(scrollRef.current, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });

        return () => observer.disconnect();
      }
      return;
    }

    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        debouncedCheckScrollable();
      }
    });

    resizeObserverRef.current.observe(scrollRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [debouncedCheckScrollable]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const containerStyle = useMemo(() => ({
    maxHeight
  }), [maxHeight]);

  const fadeIndicatorStyle = useMemo(() => ({
    opacity: showScrollHint ? 1 : 0
  }), [showScrollHint]);

  return (
    <div
      ref={containerRef}
      className={`card-content-container ${className}`}
      {...props}
    >
      <div
        ref={scrollRef}
        className={`overflow-y-auto card-content-scroll ${contentClassName}`}
        style={containerStyle}
        onScroll={handleScroll}
      >
        {children}
      </div>
      <div
        className={`card-content-fade-indicator ${fadeIndicatorClassName}`}
        style={fadeIndicatorStyle}
      />
    </div>
  );
});

ScrollableContainer.displayName = 'ScrollableContainer';

export default ScrollableContainer; 