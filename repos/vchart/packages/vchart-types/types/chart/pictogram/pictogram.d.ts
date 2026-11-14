import { BaseChart } from '../base/base-chart';
import type { IPictogramChartSpec } from './interface';
import { PictogramChartSpecTransformer } from './pictogram-transformer';
export declare class PictogramChart<T extends IPictogramChartSpec = IPictogramChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof PictogramChartSpecTransformer;
    readonly transformerConstructor: typeof PictogramChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerPictogramChart: () => void;
