import type { IWordCloudChartSpec } from './interface';
import { BaseWordCloudChart } from './base/base';
import { BaseWordCloudChartSpecTransformer } from './base/word-cloud-base-transformer';
export declare class WordCloudChart extends BaseWordCloudChart<IWordCloudChartSpec> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof BaseWordCloudChartSpecTransformer;
    readonly transformerConstructor: typeof BaseWordCloudChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerWordCloudChart: () => void;
export declare const registerWordCloudShapeChart: () => void;
