import { BaseChartSpecTransformer } from '../base';
import type { ICorrelationChartSpec } from './interface';
export declare class CorrelationChartSpecTransformer<T extends ICorrelationChartSpec = ICorrelationChartSpec> extends BaseChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
