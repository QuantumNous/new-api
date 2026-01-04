export function getMiddle(value: number, [min, max]) {
    return Math.min(Math.max(value, min), max);
}

export function getAspectHW(width: number, height: number, aspect: number) {
    if (width / height > aspect) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }
    return [width, height];
}