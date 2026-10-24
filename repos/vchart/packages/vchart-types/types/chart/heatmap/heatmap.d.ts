import type { IHeatmapChartSpec } from './interface';
import { HeatmapChartSpecTransformer } from './heatmap-transformer';
import { BaseChart } from '../base';
export declare class HeatmapChart<T extends IHeatmapChartSpec = IHeatmapChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof HeatmapChartSpecTransformer;
    readonly transformerConstructor: typeof HeatmapChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerHeatmapChart: () => void;
