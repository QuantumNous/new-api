import { array, last as peek, maxInArray as maxInArr, minInArray as minInArr } from '@visactor/vutils';
export declare function shallowCompare<T, U>(arrA: T | T[], arrB: U | U[]): boolean;
export declare function combineDomains(domains: number[][]): number[];
export declare function moveAfterInArray<T>(array: T[], target: T, ref: T): void;
export { array, peek, maxInArr, minInArr };
