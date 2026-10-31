import { BaseChart } from '../base/base-chart';
import type { ISunburstChartSpec } from './interface';
import { SunburstChartSpecTransformer } from './sunburst-transformer';
export declare class SunburstChart<T extends ISunburstChartSpec = ISunburstChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof SunburstChartSpecTransformer;
    readonly transformerConstructor: typeof SunburstChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerSunburstChart: () => void;
