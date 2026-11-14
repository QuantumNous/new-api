import { BaseChart } from '../base/base-chart';
import type { ICirclePackingChartSpec } from './interface';
import { CirclePackingChartSpecTransformer } from './circle-packing-transformer';
export declare class CirclePackingChart<T extends ICirclePackingChartSpec = ICirclePackingChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof CirclePackingChartSpecTransformer;
    readonly transformerConstructor: typeof CirclePackingChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerCirclePackingChart: () => void;
