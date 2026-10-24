import type { IChartSpecInfo } from '../chart/interface';
import type { IBaseModelSpecTransformer, IBaseModelSpecTransformerOption, IModelSpec } from './interface';
export declare class BaseModelSpecTransformer<T extends IModelSpec, K> implements IBaseModelSpecTransformer {
    readonly type: string;
    protected _option: IBaseModelSpecTransformerOption;
    protected _theme?: K;
    constructor(option: IBaseModelSpecTransformerOption);
    protected _initTheme(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
    getTheme(spec: T, chartSpec: any): K;
    transformSpec(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): {
        spec: T;
        theme: K;
    };
    protected _transformSpecBeforeMergingTheme(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): void;
    protected _transformSpecAfterMergingTheme(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): void;
    protected _mergeThemeToSpec(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
    protected _shouldMergeThemeToSpec(): boolean;
    protected _getDefaultSpecFromChart(chartSpec: any): Partial<T> | undefined;
}
