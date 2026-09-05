import { LineLikeSeriesMixin } from '../mixin/line-mixin';
import type { IMark } from '../../mark/interface';
import type { Datum } from '../../typings';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { IRadarSeriesSpec } from './interface';
import { RoseLikeSeries } from '../polar/rose-like';
import { LineLikeSeriesSpecTransformer } from '../mixin/line-mixin-transformer';
export interface RadarSeries<T extends IRadarSeriesSpec> extends Pick<LineLikeSeriesMixin, 'initLineMark' | 'initSymbolMark' | 'initLabelMarkStyle' | 'initLineMarkStyle' | 'initSymbolMarkStyle' | 'encodeDefined' | '_lineMark' | '_symbolMark' | 'addOverlapCompile'>, RoseLikeSeries<T> {
}
export declare class RadarSeries<T extends IRadarSeriesSpec = IRadarSeriesSpec> extends RoseLikeSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        radar: import("./interface").IRadarSeriesTheme;
    };
    static readonly transformerConstructor: any;
    readonly transformerConstructor: typeof LineLikeSeriesSpecTransformer;
    private _areaMark;
    protected _sortDataByAxis: boolean;
    initGroups(): void;
    compile(): void;
    initMark(): void;
    initMarkStyle(): void;
    initAreaMark(isSeriesMark: boolean): void;
    initAreaMarkStyle(): void;
    protected initTooltip(): void;
    initAnimation(): void;
    getDefaultShapeType(): string;
    getActiveMarks(): IMark[];
    getSeriesStyle(datum: Datum): (attribute: string) => any;
}
export declare const registerRadarSeries: () => void;
