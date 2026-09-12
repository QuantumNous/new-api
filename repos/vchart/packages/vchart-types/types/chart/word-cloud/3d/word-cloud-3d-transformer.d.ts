import type { AdaptiveSpec } from '../../../typings';
import { BaseWordCloudChartSpecTransformer } from '../base/word-cloud-base-transformer';
import type { IWordCloud3dChartSpec } from '../interface';
export declare class WordCloud3dChartSpecTransformer<T extends IWordCloud3dChartSpec = IWordCloud3dChartSpec> extends BaseWordCloudChartSpecTransformer<AdaptiveSpec<T, 'type' | 'series'>> {
    protected _getDefaultSeriesSpec(spec: IWordCloud3dChartSpec): any;
}
