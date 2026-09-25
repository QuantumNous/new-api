import type { IFunnelSeriesSpec } from '../../series';
import { BaseChartSpecTransformer } from '../base';
import type { IFunnelChartSpec } from './interface';
export declare class FunnelChartSpecTransformer<T extends IFunnelChartSpec> extends BaseChartSpecTransformer<T> {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: T): IFunnelSeriesSpec;
    transformSpec(spec: T): void;
}
