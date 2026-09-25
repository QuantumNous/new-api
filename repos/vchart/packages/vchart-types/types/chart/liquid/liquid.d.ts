import type { ILiquidChartSpec } from './interface';
import { BaseChart } from '../base';
import { LiquidChartSpecTransformer } from './liquid-transformer';
export declare class LiquidChart<T extends ILiquidChartSpec = ILiquidChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof LiquidChartSpecTransformer;
    readonly transformerConstructor: typeof LiquidChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerLiquidChart: () => void;
