export function isObject(val: any): val is Record<string, any> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function isNumber(val: any): val is number {
    return typeof val === 'number';
}

export function findFirstIdxMonotonousOrArrLen<T>(
    array: readonly T[],
    predicate: (item: T) => boolean,
    startIdx = 0,
    endIdxEx = array.length
): number {
    let i = startIdx;
    let j = endIdxEx;
    while (i < j) {
        const k = Math.floor((i + j) / 2);
        if (predicate(array[k])) {
            j = k;
        } else {
            i = k + 1;
        }
    }
    return i;
}