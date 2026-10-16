import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { IRoseSeriesSpec } from './interface';
import { RoseLikeSeries } from '../polar/rose-like';
import type { ILabelMark, IMark, ITextMark } from '../../mark/interface';
import { RoseSeriesSpecTransformer } from './rose-transformer';
export declare const DefaultBandWidth = 0.5;
export declare class RoseSeries<T extends IRoseSeriesSpec = IRoseSeriesSpec> extends RoseLikeSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        rose: import("./interface").IRoseSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: typeof RoseSeriesSpecTransformer;
    private _roseMark;
    protected _labelMark: ITextMark | null;
    initMark(): void;
    initMarkStyle(): void;
    protected _buildMarkAttributeContext(): void;
    private initRoseMark;
    private getRoseAngle;
    private startAngleScale;
    private endAngleScale;
    private initRoseMarkStyle;
    protected initTooltip(): void;
    initLabelMarkStyle(textMark: ILabelMark): void;
    initAnimation(): void;
    getDefaultShapeType(): string;
    getActiveMarks(): IMark[];
}
export declare const registerRoseSeries: () => void;
