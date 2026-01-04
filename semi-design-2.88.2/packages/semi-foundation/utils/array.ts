import { pullAll as setPullAll } from './set';

/**
 * arrayA remove arrayB
 * @param {array} arrayA
 * @param {array} arrayB
 * @returns {array}  new array
 *
 * const arrayA = ['a', 'b', 'c', 'a', 'b', 'c'];
 *
 * const result = pullAll(arrayA, ['a', 'c'])
 * console.log(result);
 * => ['b', 'b']
 */
export function pullAll(arrayA: any[], arrayB: any[]) {
    if (arrayA !== null && arrayA.length && arrayB !== null && arrayB.length) {
        const setA = new Set(arrayA);
        const setB = new Set(arrayB);
        const resultSet = setPullAll(setA, setB);
        return Array.from(resultSet);
    }
    return arrayA;
}
type CompareFn<T> = (a: T, b: T, sortOrder: 'ascend' | 'descend') => number;
/**
 * Adapt the descending order
 * @param {Function} fn
 * @param {String} order
 * @returns
 */
export function withOrderSort<T = any>(fn: CompareFn<T>, order: 'ascend' | 'descend' = 'ascend'): (a: T, b: T) => number {
    switch (order) {
        case 'descend':
            return (
                (a: any, b: any) => {
                    const result = Number(fn(a, b, order));
                    return result !== 0 ? -result : result;
                }
            );
        case 'ascend':
        default:
            return (a: any, b: any) => fn(a, b, order);
    }
}