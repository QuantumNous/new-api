import { CartesianSeries } from '../../cartesian/cartesian';
import type { SeriesMarkMap } from '../../interface';
import { SeriesTypeEnum } from '../../interface/type';
import type { ILinearProgressSeriesSpec } from './interface';
import type { IMark } from '../../../mark/interface';
import type { ISeriesSpecUpdatePolicy } from '../../base/base-series';
export declare class LinearProgressSeries<T extends ILinearProgressSeriesSpec = ILinearProgressSeriesSpec> extends CartesianSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        linearProgress: import("./interface").ILinearProgressSeriesTheme;
    };
    private _progressMark;
    private _trackMark;
    protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy;
    initMark(): void;
    initMarkStyle(): void;
    private _initProgressMark;
    private _initProgressMarkStyle;
    private _defaultProgressCustomShape;
    private _initTrackMark;
    private _initTrackMarkStyle;
    getInteractionTriggers(): {
        trigger: Partial<import("../../../interaction/interface/trigger").IBaseTriggerOptions>;
        marks: IMark[];
    }[];
    initAnimation(): void;
    protected initTooltip(): void;
    getActiveMarks(): IMark[];
}
export declare const registerLinearProgressSeries: () => void;
