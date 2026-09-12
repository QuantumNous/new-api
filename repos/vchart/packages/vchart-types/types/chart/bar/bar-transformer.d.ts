import { CartesianChartSpecTransformer } from '../cartesian';
import type { IBarChartSpec } from './interface';
export declare class BarChartSpecTransformer<T extends IBarChartSpec = IBarChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
    protected _transformAxisSpec(spec: T): void;
}
