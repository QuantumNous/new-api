import type { AdaptiveSpec } from '../../typings';
import { BarChartSpecTransformer } from '../bar';
import type { IWaterfallChartSpec } from './interface';
export declare class WaterfallChartSpecTransformer<T extends IWaterfallChartSpec = IWaterfallChartSpec> extends BarChartSpecTransformer<AdaptiveSpec<T, 'type' | 'series' | 'label'>> {
    transformSpec(spec: AdaptiveSpec<T, 'type' | 'series' | 'label'>): void;
    protected _getDefaultSeriesSpec(spec: AdaptiveSpec<T, 'type' | 'series' | 'label'>): any;
}
