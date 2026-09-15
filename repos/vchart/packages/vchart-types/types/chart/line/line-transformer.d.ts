import { CartesianChartSpecTransformer } from '../cartesian';
import type { ILineChartSpec } from './interface';
export declare class LineChartSpecTransformer<T extends ILineChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
