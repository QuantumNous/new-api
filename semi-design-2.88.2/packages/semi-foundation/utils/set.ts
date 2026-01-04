import { isSet } from 'lodash';

/* istanbul ignore next */
export function copySet<T = unknown>(setA: Iterable<T>) {
    return new Set(setA);
}

/**
 * Set deduplicate
 * @param {*} setA
 * @param {*} setB
 */
export function pullAll(setA: Iterable<any>, setB: Iterable<any>) {
    if (setA === setB) {
        setB = copySet(setB);
    }

    if (isSet(setA) && setA.size && isSet(setB) && setB.size) {
        for (const item of setB) {
            if (setA.has(item)) {
                setA.delete(item);
            }
        }
        return setA;
    }

    return setA;
}
