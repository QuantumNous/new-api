import { CartesianChartSpecTransformer } from '../cartesian';
import type { IHeatmapChartSpec } from './interface';
export declare class HeatmapChartSpecTransformer<T extends IHeatmapChartSpec = IHeatmapChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
}
