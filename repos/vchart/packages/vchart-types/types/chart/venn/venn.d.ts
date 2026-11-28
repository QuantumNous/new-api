import { BaseChart } from '../base/base-chart';
import type { IVennChartSpec } from './interface';
import type { AdaptiveSpec } from '../../typings';
import { VennChartSpecTransformer } from './venn-transformer';
export declare class VennChart<T extends IVennChartSpec = IVennChartSpec> extends BaseChart<AdaptiveSpec<T, 'data' | 'series'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof VennChartSpecTransformer;
    readonly transformerConstructor: typeof VennChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerVennChart: () => void;
