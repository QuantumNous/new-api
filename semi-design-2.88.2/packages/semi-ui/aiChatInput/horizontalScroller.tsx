import React, { useState, useRef, useEffect, useCallback } from "react";
import { IconChevronRightStroked } from "@douyinfe/semi-icons";
import { numbers } from "@douyinfe/semi-foundation/aiChatInput/constants";

const HorizontalScroller = ({ children, prefix }) => {
    const scrollContainerRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollAbility = useCallback(() => {
        const container = scrollContainerRef.current;
        if (container) {
            const { scrollLeft, scrollWidth, clientWidth } = container;
            setCanScrollLeft(scrollLeft > 1);
            setCanScrollRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth);
        }
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return undefined;
        checkScrollAbility();
        const resizeObserver = new ResizeObserver(checkScrollAbility);
        resizeObserver.observe(container);
        container.addEventListener("scroll", checkScrollAbility);
        return () => {
            resizeObserver.disconnect();
            container.removeEventListener("scroll", checkScrollAbility);
        };
    }, [checkScrollAbility, children]);

    const handleScroll = useCallback((scrollAmount: number) => {
        const container = scrollContainerRef.current;
        if (container) {
            container.scrollBy({
                left: scrollAmount,
                behavior: "smooth",
            });
        }
    }, []);

    const handleScrollLeft = useCallback(() => {
        // Todo, scroll amount can be custom by user through props?
        handleScroll(-numbers.SCROLL_AMOUNT);
    }, [handleScroll]);

    const handleScrollRight = useCallback(() => {
        handleScroll(numbers.SCROLL_AMOUNT);
    }, [handleScroll]);

    return (
        <div className={`${prefix}-scroll-wrapper`}>
            {canScrollLeft && (
                <button
                    className={`${prefix}-scroll-button ${prefix}-scroll-button-left`}
                    onClick={handleScrollLeft}
                    aria-label="Scroll left"
                >
                    <IconChevronRightStroked className={`${prefix}-scroll-button-left-icon`} />
                </button>
            )}
            <div className={`${prefix}-scroll-container`} ref={scrollContainerRef}>
                {children}
            </div>
            {canScrollRight && (
                <button
                    className={`${prefix}-scroll-button ${prefix}-scroll-button-right `}
                    onClick={handleScrollRight}
                    aria-label="Scroll right"
                >
                    <IconChevronRightStroked />
                </button>
            )}
        </div>
    );
};

export default HorizontalScroller;
