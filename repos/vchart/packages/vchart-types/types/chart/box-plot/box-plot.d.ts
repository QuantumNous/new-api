import type { IBoxPlotChartSpec } from './interface';
import { BoxPlotChartSpecTransformer } from './box-plot-transformer';
import { BaseChart } from '../base';
export declare class BoxPlotChart<T extends IBoxPlotChartSpec = IBoxPlotChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof BoxPlotChartSpecTransformer;
    readonly transformerConstructor: typeof BoxPlotChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerBoxplotChart: () => void;
