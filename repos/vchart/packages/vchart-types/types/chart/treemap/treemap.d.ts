import { BaseChart } from '../base/base-chart';
import type { ITreemapChartSpec } from './interface';
import type { AdaptiveSpec } from '../../typings';
import { TreemapChartSpecTransformer } from './treemap-transformer';
export declare class TreemapChart<T extends ITreemapChartSpec = ITreemapChartSpec> extends BaseChart<AdaptiveSpec<T, 'data' | 'series'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof TreemapChartSpecTransformer;
    readonly transformerConstructor: typeof TreemapChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerTreemapChart: () => void;
