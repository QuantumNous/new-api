import { BaseChartSpecTransformer } from '../base';
import type { ISankeyChartSpec } from './interface';
export declare class SankeyChartSpecTransformer<T extends ISankeyChartSpec = ISankeyChartSpec> extends BaseChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
