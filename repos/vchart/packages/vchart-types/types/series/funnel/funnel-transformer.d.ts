import { BaseSeriesSpecTransformer } from '../base';
import type { IFunnelSeriesSpec, IFunnelSeriesTheme } from './interface';
export declare class FunnelSeriesSpecTransformer<T extends IFunnelSeriesSpec = IFunnelSeriesSpec, K extends IFunnelSeriesTheme = IFunnelSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
