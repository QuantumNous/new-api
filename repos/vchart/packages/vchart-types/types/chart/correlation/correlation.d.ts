import { BaseChart } from '../base/base-chart';
import type { ICorrelationChartSpec } from './interface';
import { CorrelationChartSpecTransformer } from './correlation-transformer';
export declare class CorrelationChart<T extends ICorrelationChartSpec = ICorrelationChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof CorrelationChartSpecTransformer;
    readonly transformerConstructor: typeof CorrelationChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerCorrelationChart: () => void;
