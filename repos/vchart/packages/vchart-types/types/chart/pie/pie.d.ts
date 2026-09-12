import { BasePieChart } from './base/base';
import type { IPieChartSpec } from './interface';
import { BasePieChartSpecTransformer } from './base';
export declare class PieChart<T extends IPieChartSpec = IPieChartSpec> extends BasePieChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof BasePieChartSpecTransformer;
    readonly transformerConstructor: typeof BasePieChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerPieChart: () => void;
