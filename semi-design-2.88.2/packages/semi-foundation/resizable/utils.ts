
export const clamp = (n: number, min: number, max: number): number => Math.max(Math.min(n, max), min);
export const snap = (n: number, size: number): number => Math.round(n / size) * size;
export const has = (dir: 'top' | 'right' | 'bottom' | 'left', target: string): boolean => new RegExp(dir, 'i').test(target);
export const findNextSnap = (n: number, snapArray: number[], snapGap: number = 0): number => {
    const closestGapIndex = snapArray.reduce(
        (prev, curr, index) => (Math.abs(curr - n) < Math.abs(snapArray[prev] - n) ? index : prev),
        0
    );
    const gap = Math.abs(snapArray[closestGapIndex] - n);

    return snapGap === 0 || gap < snapGap ? snapArray[closestGapIndex] : n;
};
export const getStringSize = (n: number | string): string => {
    n = n.toString();
    if (n === 'auto') {
        return n;
    }
    if (n.endsWith('px')) {
        return n;
    }
    if (n.endsWith('%')) {
        return n;
    }
    if (n.endsWith('vh')) {
        return n;
    }
    if (n.endsWith('vw')) {
        return n;
    }
    if (n.endsWith('vmax')) {
        return n;
    }
    if (n.endsWith('vmin')) {
        return n;
    }
    return `${n}px`;
};
export const getNumberSize = (
    size: undefined | string | number,
    parentSize: number,
    innerWidth: number,
    innerHeight: number
) => {
    if (size && typeof size === 'string') {
        if (size.endsWith('px')) {
            return Number(size.replace('px', ''));
        }
        if (size.endsWith('%')) {
            const ratio = Number(size.replace('%', '')) / 100;
            return parentSize * ratio;
        }
        if (size.endsWith('vw')) {
            const ratio = Number(size.replace('vw', '')) / 100;
            return innerWidth * ratio;
        }
        if (size.endsWith('vh')) {
            const ratio = Number(size.replace('vh', '')) / 100;
            return innerHeight * ratio;
        }
    }
    return typeof size === 'undefined' ? size : Number(size);
};
export const calculateNewMax = (
    parentSize: { width: number; height: number },
    innerWidth: number,
    innerHeight: number,
    maxWidth?: string | number,
    maxHeight?: string | number,
    minWidth?: string | number,
    minHeight?: string | number
) => {
    maxWidth = getNumberSize(maxWidth, parentSize.width, innerWidth, innerHeight);
    maxHeight = getNumberSize(maxHeight, parentSize.height, innerWidth, innerHeight);
    minWidth = getNumberSize(minWidth, parentSize.width, innerWidth, innerHeight);
    minHeight = getNumberSize(minHeight, parentSize.height, innerWidth, innerHeight);
    return {
        maxWidth,
        maxHeight,
        minWidth,
        minHeight,
    };
};
export const getItemDirection = (dir: 'vertical' | 'horizontal') => {
    if (dir === 'vertical') {
        return ['bottom', 'top'];
    } else {
        return ['right', 'left'];
    }
};

export const getPixelSize = (size: string, parentSize: number): number => {
    if (size.endsWith('px')) {
        return Number(size.replace('px', ''));
    }
    if (size.endsWith('%')) {
        return Number(size.replace('%', '')) / 100 * parentSize;
    }

    return typeof size === 'undefined' ? size : Number(size);
};

export const judgeConstraint = (newSize: number, min: string, max: string, parentSize: number, offset: number = 0) => {
    min = min ?? "0%";
    max = max ?? "100%";
    const minSize = getPixelSize(min, parentSize);
    const maxSize = getPixelSize(max, parentSize);
    if (newSize < minSize + offset) {
        return true;
    }
    if (newSize > maxSize) {
        return true;
    }
    return false;
};

export const adjustNewSize = (newSize: number, min: string, max: string, parentSize: number, offset: number) => {
    min = min ?? "0%";
    max = max ?? "100%";
    const minSize = getPixelSize(min, parentSize);
    const maxSize = getPixelSize(max, parentSize);
    if (newSize < minSize + offset) {
        return minSize + offset;
    }
    if (newSize > maxSize) {
        return maxSize;
    }
    return newSize;
};

export const getOffset = (style: CSSStyleDeclaration, direction: 'horizontal' | 'vertical') => {
    if (direction === 'horizontal') {
        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingRight = parseFloat(style.paddingRight);
        const borderLeftWidth = parseFloat(style.borderLeftWidth);
        const borderRightWidth = parseFloat(style.borderRightWidth);
        return paddingLeft + paddingRight + borderLeftWidth + borderRightWidth;
    } else {
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        const borderTopWidth = parseFloat(style.borderTopWidth);
        const borderBottomWidth = parseFloat(style.borderBottomWidth);
        return paddingTop + paddingBottom + borderTopWidth + borderBottomWidth;
    }
};

