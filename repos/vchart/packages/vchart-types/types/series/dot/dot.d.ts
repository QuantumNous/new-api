import { CartesianSeries } from '../cartesian/cartesian';
import type { Datum } from '../../typings';
import type { IMark } from '../../mark/interface';
import { SeriesTypeEnum } from '../interface/type';
import type { IModelEvaluateOption } from '../../model/interface';
import type { IFillMarkSpec, VisualType } from '../../typings/visual';
import type { IDotSeriesSpec } from './interface';
import type { SeriesMarkMap } from '../interface';
export declare class DotSeries<T extends IDotSeriesSpec = IDotSeriesSpec> extends CartesianSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        dot: import("./interface").IDotSeriesTheme;
    };
    private _xDimensionStatisticsDomain;
    protected _seriesGroupField?: string;
    getSeriesGroupField(): string;
    setSeriesGroupField(field: string): void;
    protected _titleField?: string;
    getTitleField(): string;
    setTitleField(field: string): void;
    protected _subTitleField?: string;
    getSubTitleField(): string;
    setSubTitleField(field: string): void;
    protected _dotTypeField?: string;
    getDotTypeField(): string;
    setDotTypeField(field: string): void;
    protected _highLightSeriesGroup?: string;
    getHighLightSeriesGroup(): string;
    setHighLightSeriesGroup(field: string): void;
    protected _gridBackground?: IFillMarkSpec;
    setGridBackground(gridBackground: IFillMarkSpec): void;
    protected _getSpecUpdatePolicy(): {
        compileOnlyKeys: {
            highLightSeriesGroup: true;
            titleField: true;
            subTitleField: true;
        };
        compileOnlySubKeys: {
            grid: Record<"background", true>;
        };
        dataRelatedKeys?: Record<string, true>;
        seriesOnlyKeys?: Record<string, true>;
    };
    initData(): void;
    getStatisticFields(): {
        key: string;
        operations: Array<'max' | 'min' | 'values'>;
        customize: any[];
    }[];
    setAttrFromSpec(): void;
    private _clipMark;
    private _containerMark;
    private _gridBackgroundMark;
    private _gridMark;
    private _dotMark;
    private _titleMark;
    private _subTitleMark;
    private _symbolMark;
    initMark(): void;
    initMarkStyle(): void;
    dataToGridBackgroundPositionY(datum: Datum): number;
    dataToGridBackgroundPositionY1(datum: Datum): number;
    dataToOpacity(datum: Datum): number;
    dataToGridBackgroundOpacity(datum: Datum): VisualType<number>;
    onLayoutEnd(): void;
    getDefaultColorDomain(): any;
    getColorAttribute(): {
        scale: any;
        field: string;
    };
    protected getDotColorScale(): any;
    getDotColorAttribute(): {
        scale: any;
        field: string;
    };
    protected initTooltip(): void;
    onEvaluateEnd(ctx: IModelEvaluateOption): void;
    protected onMarkTreePositionUpdate(marks: IMark[]): void;
    getDotData(): import("../../compile/data").ICompilableData;
    protected _getDataIdKey(): any;
    getStackValueField(): string;
    getActiveMarks(): IMark[];
}
export declare const registerDotSeries: () => void;
