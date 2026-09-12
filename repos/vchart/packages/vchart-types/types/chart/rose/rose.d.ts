import type { IRoseChartSpec } from './interface';
import { RoseChartSpecTransformer } from './rose-transformer';
import { BaseChart } from '../base';
export declare class RoseChart<T extends IRoseChartSpec = IRoseChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof RoseChartSpecTransformer;
    readonly transformerConstructor: typeof RoseChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerRoseChart: () => void;
