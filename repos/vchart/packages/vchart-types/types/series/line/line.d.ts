import { CartesianSeries } from '../cartesian/cartesian';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import { LineLikeSeriesMixin } from '../mixin/line-mixin';
import type { Datum } from '../../typings';
import type { ILineSeriesSpec } from './interface';
import type { IMark } from '../../mark/interface';
import { LineLikeSeriesSpecTransformer } from '../mixin/line-mixin-transformer';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';
export interface LineSeries<T extends ILineSeriesSpec = ILineSeriesSpec> extends Pick<LineLikeSeriesMixin, 'initLineMark' | 'initSymbolMark' | 'initLabelMarkStyle' | 'initLineMarkStyle' | 'initSymbolMarkStyle' | '_lineMark' | '_symbolMark' | 'addSamplingCompile' | 'addOverlapCompile' | 'reCompileSampling'>, CartesianSeries<T> {
}
export declare class LineSeries<T extends ILineSeriesSpec = ILineSeriesSpec> extends CartesianSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    static readonly builtInTheme: {
        line: import("../mixin/interface").ILineLikeSeriesTheme;
    };
    static readonly transformerConstructor: typeof LineLikeSeriesSpecTransformer;
    readonly transformerConstructor: typeof LineLikeSeriesSpecTransformer;
    protected _sortDataByAxis: boolean;
    protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy;
    compile(): void;
    initMark(): void;
    protected initTooltip(): void;
    initMarkStyle(): void;
    initAnimation(): void;
    onLayoutEnd(): void;
    getSeriesStyle(datum: Datum): (attribute: string) => unknown;
    getDefaultShapeType(): string;
    getActiveMarks(): IMark[];
}
export declare const registerLineSeries: () => void;
