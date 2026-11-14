import type { IBarChartSpec } from './interface';
import { BarChartSpecTransformer } from './bar-transformer';
import { BaseChart } from '../base';
export declare class BarChart<T extends IBarChartSpec = IBarChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof BarChartSpecTransformer;
    readonly transformerConstructor: typeof BarChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerBarChart: () => void;
