import type { AdaptiveSpec } from '../../typings';
import { ProgressLikeChartSpecTransformer } from '../polar';
import type { IGaugeChartSpec } from './interface';
export declare class GaugeChartSpecTransformer<T extends IGaugeChartSpec = IGaugeChartSpec> extends ProgressLikeChartSpecTransformer<AdaptiveSpec<T, 'axes'>> {
    protected _getDefaultSeriesSpec(spec: T): any;
    protected _getDefaultCircularProgressSeriesSpec(spec: T): any;
    transformSpec(spec: AdaptiveSpec<T, 'axes'>): void;
    protected _transformGaugeAxisSpec(spec: AdaptiveSpec<T, 'axes'>): void;
}
