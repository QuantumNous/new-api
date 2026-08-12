import { BaseChart } from '../../base';
import type { IHistogramChartSpec } from '../interface';
import { BaseHistogramChartSpecTransformer } from './histogram-base-transformer';
export declare class BaseHistogramChart<T extends IHistogramChartSpec> extends BaseChart<T> {
    static readonly transformerConstructor: typeof BaseHistogramChartSpecTransformer;
    readonly transformerConstructor: typeof BaseHistogramChartSpecTransformer;
}
