import type { IAreaChartSpec } from './interface';
import { AreaChartSpecTransformer } from './area-transformer';
import { BaseChart } from '../base';
export declare class AreaChart<T extends IAreaChartSpec = IAreaChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof AreaChartSpecTransformer;
    readonly transformerConstructor: typeof AreaChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerAreaChart: () => void;
