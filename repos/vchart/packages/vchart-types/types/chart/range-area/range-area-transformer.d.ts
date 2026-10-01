import { CartesianChartSpecTransformer } from '../cartesian';
import type { IRangeAreaChartSpec } from './interface';
export declare class RangeAreaChartSpecTransformer<T extends IRangeAreaChartSpec = IRangeAreaChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
