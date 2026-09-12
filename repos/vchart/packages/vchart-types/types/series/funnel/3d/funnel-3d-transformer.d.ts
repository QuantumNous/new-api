import type { AdaptiveSpec } from '../../../typings';
import type { IFunnel3dSeriesSpec, IFunnel3dSeriesTheme } from '../interface';
import { FunnelSeriesSpecTransformer } from '../funnel-transformer';
export declare class Funnel3dSeriesSpecTransformer<T extends IFunnel3dSeriesSpec = IFunnel3dSeriesSpec, K extends IFunnel3dSeriesTheme = IFunnel3dSeriesTheme> extends FunnelSeriesSpecTransformer<AdaptiveSpec<T, 'type'>, K> {
    protected _transformLabelSpec(spec: AdaptiveSpec<T, 'type'>): void;
}
