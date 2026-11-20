import { BaseHistogramChart } from '../base/base';
import type { IHistogram3dChartSpec } from '../interface';
import type { AdaptiveSpec } from '../../../typings';
import { HistogramChartSpecTransformer } from '../histogram-transformer';
export declare class Histogram3dChart<T extends IHistogram3dChartSpec> extends BaseHistogramChart<AdaptiveSpec<T, 'type'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof HistogramChartSpecTransformer;
    readonly transformerConstructor: typeof HistogramChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerHistogram3dChart: () => void;
