import { CartesianSeries } from '../cartesian/cartesian';
import type { IHeatmapSeriesSpec } from './interface';
import type { IAxisHelper } from '../../component/axis/cartesian/interface';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { ICellMark, IMark, ITextMark } from '../../mark/interface';
import { HeatmapSeriesSpecTransformer } from './heatmap-transformer';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';
export declare const DefaultBandWidth = 6;
export declare class HeatmapSeries<T extends IHeatmapSeriesSpec = IHeatmapSeriesSpec> extends CartesianSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        heatmap: import("./interface").IHeatmapSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: typeof HeatmapSeriesSpecTransformer;
    protected _cellMark: ICellMark;
    protected _backgroundMark: ICellMark;
    protected _fieldValue: string[];
    getFieldValue(): string[];
    setFieldValue(f: string | string[]): void;
    protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy;
    setAttrFromSpec(): void;
    initMark(): void;
    initMarkStyle(): void;
    initLabelMarkStyle(textMark: ITextMark): void;
    initCellMarkStyle(): void;
    initCellBackgroundMarkStyle(): void;
    getColorAttribute(): {
        scale: any;
        field: string;
    };
    getInteractionTriggers(): {
        trigger: Partial<import("../../interaction/interface/trigger").IBaseTriggerOptions>;
        marks: IMark[];
    }[];
    initAnimation(): void;
    protected getCellSize(axisHelper: IAxisHelper): number;
    protected initTooltip(): void;
    getDefaultShapeType(): string;
    getDimensionField(): string[];
    getMeasureField(): string[];
    getActiveMarks(): IMark[];
}
export declare const registerHeatmapSeries: () => void;
