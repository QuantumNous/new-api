import type { IFunnel3dChartSpec } from '../interface';
import type { AdaptiveSpec } from '../../../typings';
import { FunnelChartSpecTransformer } from '../funnel-transformer';
import { BaseChart } from '../../base';
export declare class Funnel3dChart<T extends IFunnel3dChartSpec = IFunnel3dChartSpec> extends BaseChart<AdaptiveSpec<T, 'type'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof FunnelChartSpecTransformer;
    readonly transformerConstructor: typeof FunnelChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerFunnel3dChart: () => void;
