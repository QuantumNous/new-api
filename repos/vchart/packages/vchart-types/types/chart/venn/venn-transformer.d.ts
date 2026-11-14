import type { AdaptiveSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { IVennChartSpec } from './interface';
export declare class VennChartSpecTransformer<T extends IVennChartSpec = IVennChartSpec> extends BaseChartSpecTransformer<AdaptiveSpec<T, 'data' | 'series'>> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: any): void;
}
