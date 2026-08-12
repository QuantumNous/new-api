import { BaseChartSpecTransformer } from '../base';
import type { ISunburstChartSpec } from './interface';
import type { ISunburstSeriesSpec } from '../../series';
export declare class SunburstChartSpecTransformer<T extends ISunburstChartSpec = ISunburstChartSpec> extends BaseChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): ISunburstSeriesSpec;
    transformSpec(spec: T): void;
}
