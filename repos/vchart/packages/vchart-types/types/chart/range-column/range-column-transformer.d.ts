import { CartesianChartSpecTransformer } from '../cartesian';
import type { IRangeColumnChartSpec } from './interface';
export declare class RangeColumnChartSpecTransformer<T extends IRangeColumnChartSpec = IRangeColumnChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
