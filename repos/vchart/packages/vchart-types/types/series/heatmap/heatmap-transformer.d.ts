import { BaseSeriesSpecTransformer } from '../base';
import type { IHeatmapSeriesSpec, IHeatmapSeriesTheme } from './interface';
export declare class HeatmapSeriesSpecTransformer<T extends IHeatmapSeriesSpec = IHeatmapSeriesSpec, K extends IHeatmapSeriesTheme = IHeatmapSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
