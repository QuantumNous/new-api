import { BarSeries } from '../bar/bar';
import type { SeriesMarkMap } from '../interface';
import type { Datum } from '../../typings';
import type { IRangeColumnSeriesSpec } from './interface';
import type { ITextMark } from '../../mark/interface';
export declare const DefaultBandWidth = 6;
export declare class RangeColumnSeries<T extends IRangeColumnSeriesSpec = IRangeColumnSeriesSpec> extends BarSeries<any> {
    static readonly type: string;
    type: string;
    protected _barMarkType: string;
    protected _barName: string;
    protected _spec: T;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        rangeColumn: import("./interface").IRangeColumnSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: any;
    private _minLabelMark?;
    private _maxLabelMark?;
    private _labelMark?;
    initMark(): void;
    initMarkStyle(): void;
    _initLabelMarkPos(labelMark: ITextMark, labelSpec: IRangeColumnSeriesSpec['label']['minLabel'], fieldIndex: number, defaultPosition: string): void;
    initLabelMarkStyle(labelMark: ITextMark): void;
    protected _dataToPosX(datum: Datum): number;
    protected _dataToPosX1(datum: Datum): number;
    protected _dataToPosY(datum: Datum): number;
    protected _dataToPosY1(datum: Datum): number;
    initAnimation(): void;
    protected initTooltip(): void;
}
export declare const registerRangeColumnSeries: () => void;
