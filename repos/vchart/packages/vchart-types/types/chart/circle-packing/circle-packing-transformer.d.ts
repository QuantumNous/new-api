import type { ICirclePackingSeriesSpec } from '../../series/circle-packing/interface';
import { BaseChartSpecTransformer } from '../base';
import type { ICirclePackingChartSpec } from './interface';
export declare class CirclePackingChartSpecTransformer<T extends ICirclePackingChartSpec = ICirclePackingChartSpec> extends BaseChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: ICirclePackingChartSpec): ICirclePackingSeriesSpec;
    transformSpec(spec: T): void;
}
