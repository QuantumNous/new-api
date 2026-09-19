import { BarChart } from '../bar';
import type { IWaterfallChartSpec } from './interface';
import type { AdaptiveSpec } from '../../typings';
import { WaterfallChartSpecTransformer } from './waterfall-transformer';
export declare class WaterfallChart<T extends IWaterfallChartSpec = IWaterfallChartSpec> extends BarChart<AdaptiveSpec<T, 'type' | 'series' | 'label'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof WaterfallChartSpecTransformer;
    readonly transformerConstructor: typeof WaterfallChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerWaterfallChart: () => void;
