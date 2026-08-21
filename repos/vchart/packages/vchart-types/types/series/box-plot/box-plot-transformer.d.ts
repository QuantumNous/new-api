import { BaseSeriesSpecTransformer } from '../base';
import type { IBoxPlotSeriesSpec, IBoxPlotSeriesTheme } from './interface';
export declare class BoxPlotSeriesSpecTransformer<T extends IBoxPlotSeriesSpec = IBoxPlotSeriesSpec, K extends IBoxPlotSeriesTheme = IBoxPlotSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
