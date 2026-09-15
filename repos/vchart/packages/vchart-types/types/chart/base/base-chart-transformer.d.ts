import type { IChartSpec, ISeriesSpec } from '../../typings';
import type { IChartSpecInfo, IChartSpecTransformer, IChartSpecTransformerOption } from '../interface';
import type { IModelConstructor, IModelSpecInfo } from '../../model/interface';
import type { IRegionConstructor } from '../../region/interface';
import type { ISeriesConstructor } from '../../series';
import type { IComponentConstructor } from '../../component/interface/common';
import type { ICartesianBandAxisSpec } from '../..//component/axis/cartesian/interface';
export declare class BaseChartSpecTransformer<T extends IChartSpec> implements IChartSpecTransformer {
    readonly type: string;
    readonly seriesType: string;
    protected _seriesRelatedSpecKeys: Record<string, true>;
    protected _option: IChartSpecTransformerOption;
    constructor(option: IChartSpecTransformerOption);
    initChartSpec(chartSpec: T): IChartSpecInfo;
    transformSpec(chartSpec: T): void;
    generateTransform(chartSpec: T, isRuntime?: boolean): (constructor: IModelConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => void;
    transformModelSpec(chartSpec: T): IChartSpecInfo;
    createSpecInfo(chartSpec: T, transform?: (constructor: IModelConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => void): IChartSpecInfo;
    protected _isValidSeries(seriesType: string): boolean;
    getSeriesRelatedSpecKeys(): Record<string, true>;
    protected _addSeriesRelatedSpecKeys(...keysList: Array<string[] | undefined>): void;
    protected _getDefaultSeriesSpec(chartSpec: any, pickKeys?: string[], pickKeys2?: string[]): any;
    forEachRegionInSpec<K>(chartSpec: T, callbackfn: (constructor: IRegionConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K, chartSpecInfo?: IChartSpecInfo): K[];
    forEachSeriesInSpec<K>(chartSpec: T, callbackfn: (constructor: ISeriesConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K, chartSpecInfo?: IChartSpecInfo): K[];
    forEachComponentInSpec<K>(chartSpec: T, callbackfn: (constructor: IComponentConstructor, specInfo: IModelSpecInfo, chartSpecInfo?: IChartSpecInfo) => K, chartSpecInfo?: IChartSpecInfo): K[];
    transformSeriesSpec(spec: T): void;
    protected _findBandAxisBySeries(seriesSpec: ISeriesSpec, seriesIndex: number, axesSpec: any): any;
    protected _applyAxisBandSize(axis: ICartesianBandAxisSpec, extend: number, barWidthSpec: {
        barMaxWidth: number | string;
        barMinWidth: number | string;
        barWidth: number | string;
        barGapInGroup: number | string | (number | string)[];
    }): void;
}
