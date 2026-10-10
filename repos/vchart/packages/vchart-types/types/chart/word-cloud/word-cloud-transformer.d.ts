import { BaseWordCloudChartSpecTransformer } from './base';
import type { IWordCloudChartSpec } from './interface';
export declare class WordCloudChartSpecTransformer<T extends IWordCloudChartSpec = IWordCloudChartSpec> extends BaseWordCloudChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: IWordCloudChartSpec): any;
}
