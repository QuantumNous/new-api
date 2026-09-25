import { BaseChartSpecTransformer } from '../../base';
import type { IWordCloudChartSpec } from '../interface';
export declare class BaseWordCloudChartSpecTransformer<T extends IWordCloudChartSpec> extends BaseChartSpecTransformer<T> {
    transformSpec(spec: T): void;
    protected _getDefaultSeriesSpec(spec: T): any;
}
