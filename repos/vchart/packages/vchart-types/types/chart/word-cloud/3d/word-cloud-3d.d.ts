import type { IWordCloud3dChartSpec } from '../interface';
import { BaseWordCloudChart } from '../base/base';
import type { AdaptiveSpec } from '../../../typings';
import { WordCloud3dChartSpecTransformer } from './word-cloud-3d-transformer';
export declare class WordCloud3dChart<T extends IWordCloud3dChartSpec = IWordCloud3dChartSpec> extends BaseWordCloudChart<AdaptiveSpec<T, 'type' | 'series'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof WordCloud3dChartSpecTransformer;
    readonly transformerConstructor: typeof WordCloud3dChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerWordCloud3dChart: () => void;
export declare const registerWordCloudShape3dChart: () => void;
