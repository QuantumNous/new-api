import type { AdaptiveSpec } from '../../../typings';
import { ProgressLikeChartSpecTransformer } from '../../polar';
import type { ICircularProgressChartSpec } from './interface';
export declare class CircularProgressChartSpecTransformer<T extends ICircularProgressChartSpec = ICircularProgressChartSpec> extends ProgressLikeChartSpecTransformer<AdaptiveSpec<T, 'axes'>> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: AdaptiveSpec<T, 'axes'>): void;
}
