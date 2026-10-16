import { BaseChart } from '../../base/base-chart';
import type { IWordCloudChartSpec } from '../interface';
import { BaseWordCloudChartSpecTransformer } from './word-cloud-base-transformer';
export declare class BaseWordCloudChart<T extends IWordCloudChartSpec> extends BaseChart<T> {
    static readonly transformerConstructor: typeof BaseWordCloudChartSpecTransformer;
    readonly transformerConstructor: typeof BaseWordCloudChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
