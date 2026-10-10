import { CartesianChartSpecTransformer } from '../cartesian';
import type { IScatterChartSpec } from './interface';
export declare class ScatterChartSpecTransformer<T extends IScatterChartSpec = IScatterChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: IScatterChartSpec): any;
}
