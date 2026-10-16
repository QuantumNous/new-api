import { BaseChartSpecTransformer } from '../base';
import type { ILiquidChartSpec } from './interface';
export declare class LiquidChartSpecTransformer<T extends ILiquidChartSpec = ILiquidChartSpec> extends BaseChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
