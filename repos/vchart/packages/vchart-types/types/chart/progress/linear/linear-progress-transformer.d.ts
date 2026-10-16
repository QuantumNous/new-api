import { CartesianChartSpecTransformer } from '../../cartesian';
import type { ILinearProgressChartSpec } from './interface';
export declare class LinearProgressChartSpecTransformer<T extends ILinearProgressChartSpec = ILinearProgressChartSpec> extends CartesianChartSpecTransformer<T> {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: T): ILinearProgressChartSpec;
    transformSpec(spec: T): void;
}
