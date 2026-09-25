import type { ICircularProgressChartSpec } from './interface';
import { CircularProgressChartSpecTransformer } from './circular-progress-transformer';
import type { AdaptiveSpec } from '../../../typings';
import { BaseChart } from '../../base';
export declare class CircularProgressChart<T extends ICircularProgressChartSpec = ICircularProgressChartSpec> extends BaseChart<AdaptiveSpec<T, 'axes'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof CircularProgressChartSpecTransformer;
    readonly transformerConstructor: typeof CircularProgressChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerCircularProgressChart: () => void;
