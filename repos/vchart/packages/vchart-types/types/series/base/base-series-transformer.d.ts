import type { IChartSpecInfo } from '../../chart/interface';
import type { ILabelSpec, TransformedLabelSpec } from '../../component/label';
import { BaseModelSpecTransformer } from '../../model/base-model-transformer';
import type { ISeriesSpec } from '../../typings';
import type { ISeriesSpecTransformerResult, SeriesMarkNameEnum } from '../interface';
import type { ISeries } from '../interface';
export declare class BaseSeriesSpecTransformer<T extends ISeriesSpec, K> extends BaseModelSpecTransformer<T, K> {
    markLabelSpec: Partial<Record<SeriesMarkNameEnum, TransformedLabelSpec[]>>;
    stack: boolean;
    protected _supportStack: boolean;
    getLabelSpec(markName: string): any;
    setLabelSpec(markName: string, label: TransformedLabelSpec | TransformedLabelSpec[]): void;
    addLabelSpec(markName: string, label: TransformedLabelSpec, head?: boolean): void;
    getTheme(spec: T, chartSpec: any): K;
    transformSpec(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): ISeriesSpecTransformerResult<T, K>;
    protected _transformLabelSpec(spec: T): void;
    protected _transformStack(spec: T): void;
    protected _addMarkLabelSpec<V extends ISeries = ISeries>(spec: T, markName: string | ((spec: ILabelSpec) => string), labelSpecKey?: keyof T, styleHandlerName?: keyof V, hasAnimation?: boolean, head?: boolean): void;
    protected _getDefaultSpecFromChart(chartSpec: any): any;
    protected _mergeThemeToSpec(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
}
