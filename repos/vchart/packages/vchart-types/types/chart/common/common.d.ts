import { BaseChart } from '../base/base-chart';
import type { ICommonChartSpec } from './interface';
import type { AdaptiveSpec } from '../../typings';
import { CommonChartSpecTransformer } from './common-transformer';
export declare class CommonChart<T extends ICommonChartSpec = ICommonChartSpec> extends BaseChart<AdaptiveSpec<T, 'series'>> {
    static readonly type: string;
    static readonly transformerConstructor: typeof CommonChartSpecTransformer;
    readonly transformerConstructor: typeof CommonChartSpecTransformer;
    readonly type: string;
    protected _setModelOption(): void;
}
export declare const registerCommonChart: () => void;
