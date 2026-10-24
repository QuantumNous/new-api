import type { IBar3dChartSpec } from '../interface';
import { BarChart } from '../bar';
import type { AdaptiveSpec } from '../../../typings';
import { Bar3dChartSpecTransformer } from './bar-3d-transformer';
export declare class Bar3dChart<T extends IBar3dChartSpec = IBar3dChartSpec> extends BarChart<AdaptiveSpec<T, 'type' | 'series'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof Bar3dChartSpecTransformer;
    readonly transformerConstructor: typeof Bar3dChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerBar3dChart: () => void;
