import type { Datum } from '../../typings';
import type { CirclePackingOptions } from '@visactor/vlayouts';
export interface ICirclePackingOpt extends CirclePackingOptions {
    width: number;
    height: number;
    valueField?: string;
}
export declare const circlePackingLayout: (data: Array<Datum>, op: () => ICirclePackingOpt) => Datum[];
