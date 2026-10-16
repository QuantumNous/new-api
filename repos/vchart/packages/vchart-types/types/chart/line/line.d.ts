import type { ILineChartSpec } from './interface';
import { LineChartSpecTransformer } from './line-transformer';
import { BaseChart } from '../base';
export declare class LineChart<T extends ILineChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof LineChartSpecTransformer;
    readonly transformerConstructor: typeof LineChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerLineChart: () => void;
