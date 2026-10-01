import type { ISeriesSpec } from '../../typings';
export declare function specTransform(spec: unknown, special?: {
    [key: string]: (v: unknown) => unknown;
}): unknown;
export declare function functionTransform(spec: ISeriesSpec, VChart: any): any;
export declare function transformFunctionAttribute(att: unknown, ...args: unknown[]): any;
