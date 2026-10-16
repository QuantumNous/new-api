import { BaseHistogramChartSpecTransformer } from './base';
import type { IHistogramChartSpec } from './interface';
export declare class HistogramChartSpecTransformer<T extends IHistogramChartSpec = IHistogramChartSpec> extends BaseHistogramChartSpecTransformer<T> {
    transformSpec(spec: T): void;
}
