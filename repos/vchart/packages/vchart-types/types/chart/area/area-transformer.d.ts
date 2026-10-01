import { CartesianChartSpecTransformer } from '../cartesian';
import type { IAreaChartSpec } from './interface';
export declare class AreaChartSpecTransformer<T extends IAreaChartSpec = IAreaChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
