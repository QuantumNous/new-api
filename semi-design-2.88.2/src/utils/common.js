export const isScrollContainerScrollToEnd = (scrollContainer, offset = 0) => {
    if (!scrollContainer) {
        return;
    }
    return scrollContainer.scrollHeight - (scrollContainer.scrollTop + scrollContainer.offsetHeight) < offset;
};

export const isDomVisibleInScrollView = (ele, scrollContainer, offset = 0) => {
    if (!(ele && scrollContainer)) {
        return;
    }
    if (ele.offsetTop < scrollContainer.scrollTop) {
        return -1;
    }
    if (ele.offsetTop > scrollContainer.scrollTop && ele.offsetTop < scrollContainer.scrollTop + scrollContainer.clientHeight) {
        return 0;
    }
    if (ele.offsetTop > scrollContainer.scrollTop + scrollContainer.clientHeight) {
        return 1;
    }
};