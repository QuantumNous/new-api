import type { IScatterChartSpec } from './interface';
import { ScatterChartSpecTransformer } from './scatter-transformer';
import { BaseChart } from '../base';
export declare class ScatterChart<T extends IScatterChartSpec = IScatterChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof ScatterChartSpecTransformer;
    readonly transformerConstructor: typeof ScatterChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerScatterChart: () => void;
