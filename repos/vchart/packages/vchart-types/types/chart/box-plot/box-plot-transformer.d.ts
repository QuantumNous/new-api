import { CartesianChartSpecTransformer } from '../cartesian';
import type { IBoxPlotChartSpec } from './interface';
export declare class BoxPlotChartSpecTransformer<T extends IBoxPlotChartSpec = IBoxPlotChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
