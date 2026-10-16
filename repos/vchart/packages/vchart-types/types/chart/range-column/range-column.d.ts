import type { IRangeColumnChartSpec } from './interface';
import { RangeColumnChartSpecTransformer } from './range-column-transformer';
import { BaseChart } from '../base';
export declare class RangeColumnChart<T extends IRangeColumnChartSpec = IRangeColumnChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof RangeColumnChartSpecTransformer;
    readonly transformerConstructor: typeof RangeColumnChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerRangeColumnChart: () => void;
