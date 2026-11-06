import type { IGaugeChartSpec } from './interface';
import { GaugeChartSpecTransformer } from './gauge-transformer';
import type { AdaptiveSpec } from '../../typings';
import { BaseChart } from '../base';
export declare class GaugeChart<T extends IGaugeChartSpec = IGaugeChartSpec> extends BaseChart<AdaptiveSpec<T, 'axes'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof GaugeChartSpecTransformer;
    readonly transformerConstructor: typeof GaugeChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerGaugeChart: () => void;
