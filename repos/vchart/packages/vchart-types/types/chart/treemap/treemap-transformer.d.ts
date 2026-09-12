import type { AdaptiveSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { ITreemapChartSpec } from './interface';
export declare class TreemapChartSpecTransformer<T extends ITreemapChartSpec = ITreemapChartSpec> extends BaseChartSpecTransformer<AdaptiveSpec<T, 'data' | 'series'>> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: any): void;
}
