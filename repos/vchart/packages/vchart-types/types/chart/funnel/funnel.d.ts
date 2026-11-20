import type { IFunnelChartSpec } from './interface';
import { FunnelChartSpecTransformer } from './funnel-transformer';
import { BaseChart } from '../base';
export declare class FunnelChart<T extends IFunnelChartSpec = IFunnelChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof FunnelChartSpecTransformer;
    readonly transformerConstructor: typeof FunnelChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerFunnelChart: () => void;
