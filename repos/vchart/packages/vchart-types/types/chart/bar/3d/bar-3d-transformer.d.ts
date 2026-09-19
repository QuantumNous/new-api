import type { AdaptiveSpec } from '../../../typings';
import type { IBar3dChartSpec } from '../interface';
import { BarChartSpecTransformer } from '../bar-transformer';
export declare class Bar3dChartSpecTransformer<T extends IBar3dChartSpec = IBar3dChartSpec> extends BarChartSpecTransformer<AdaptiveSpec<T, 'type' | 'series'>> {
    protected _getDefaultSeriesSpec(spec: AdaptiveSpec<T, 'type' | 'series'>): any;
}
