import { BarSeries } from '../bar/bar';
import type { IWaterfallSeriesSpec } from './interface';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { ITransformOptions, DataView } from '@visactor/vdataset';
import type { IModelEvaluateOption } from '../../model/interface';
import type { Datum } from '../../typings';
import type { ILabelMark, IRuleMark, ITextMark } from '../../mark/interface';
import type { ILabelInfo } from '../../component/label/interface';
import { type ICompilableData } from '../../compile/data';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';
export declare const DefaultBandWidth = 6;
export declare class WaterfallSeries<T extends IWaterfallSeriesSpec = IWaterfallSeriesSpec> extends BarSeries<any> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        waterfall: import("./interface").IWaterfallSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: any;
    protected _totalData?: ICompilableData;
    getTotalData(): any;
    protected _spec: T;
    protected _leaderLineMark: IRuleMark;
    protected _stackLabelMark: ITextMark;
    protected _labelMark: ITextMark;
    protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy;
    protected initGroups(): void;
    setAttrFromSpec(): void;
    getSeriesKeys(): string[];
    protected initData(): void;
    protected _reStackTotal: () => void;
    compileData(): void;
    initAnimation(): void;
    viewDataUpdate(d: DataView): void;
    addViewDataFilter(_option: ITransformOptions): void;
    reFilterViewData(): void;
    onEvaluateEnd(ctx: IModelEvaluateOption): void;
    initMark(): void;
    initLabelMarkStyle(labelMark: ILabelMark): void;
    initStackLabelMarkStyle(labelMark: ILabelMark): void;
    initTotalLabelMarkStyle(labelMark: ILabelMark): void;
    getTotalLabelComponentStyle(info: Pick<ILabelInfo, 'baseMark' | 'labelMark'>): {
        customLayoutFunc: (labels: import("@visactor/vrender-components").LabelItem[]) => import("@visactor/vrender-core").IText[];
        dataFilter: (labels: import("@visactor/vrender-components").LabelItem[]) => import("@visactor/vrender-components").LabelItem[];
        overlap: {
            strategy: any;
        };
    };
    totalPositionX(datum: Datum, field: string, pos?: number): number;
    totalPositionY(datum: Datum, field: string, pos?: number): number;
    protected _isCategoryAxisInverse(): boolean;
    protected _getLeaderLineCategoryPos(isStart: boolean, isDecrease: boolean): number;
    initMarkStyle(): void;
    protected isVisibleLeaderLine(datum: Datum): boolean;
}
export declare const registerWaterfallSeries: () => void;
