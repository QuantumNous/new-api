import { CartesianChartSpecTransformer } from '../../cartesian';
import type { IHistogramChartSpec } from '../interface';
export declare class BaseHistogramChartSpecTransformer<T extends IHistogramChartSpec> extends CartesianChartSpecTransformer<T> {
    transformSpec(spec: T): void;
    protected _getDefaultSeriesSpec(spec: T): any;
}
