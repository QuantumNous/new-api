import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { IGaugeSeriesSpec } from './interface';
import { ProgressLikeSeries } from '../polar/progress-like/progress-like';
import type { IMark } from '../../mark/interface';
import { GaugeSeriesSpecTransformer } from './gauge-transformer';
import type { Datum } from '../../typings/common';
export declare class GaugeSeries<T extends IGaugeSeriesSpec = IGaugeSeriesSpec> extends ProgressLikeSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        gauge: import("./interface").IGaugeSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: typeof GaugeSeriesSpecTransformer;
    private _segmentMark;
    private _trackMark;
    protected _padAngle: number;
    setAttrFromSpec(): void;
    initData(): void;
    initMark(): void;
    initMarkStyle(): void;
    private initSegmentMarkStyle;
    protected generateRadiusStyle(spec: any): any;
    initMarkStyleWithSpec(mark?: IMark, spec?: any): void;
    protected initTooltip(): void;
    private initTrackMarkStyle;
    protected _getAngleValueStartWithoutMask(datum: Datum): number;
    protected _getAngleValueEndWithoutMask(datum: Datum): number;
    protected _getAngleValueStartWithoutPadAngle(datum: Datum): number;
    protected _getAngleValueEndWithoutPadAngle(datum: Datum): number;
    initAnimation(): void;
    getDefaultShapeType(): string;
    getActiveMarks(): IMark[];
}
export declare const registerGaugeSeries: () => void;
