import type { IChartSpecInfo } from '../../chart/interface';
import { LineLikeSeriesSpecTransformer } from '../mixin/line-mixin-transformer';
import type { IAreaSeriesSpec, IAreaSeriesTheme } from './interface';
export declare class AreaSeriesSpecTransformer<T extends IAreaSeriesSpec = IAreaSeriesSpec, K extends IAreaSeriesTheme = IAreaSeriesTheme> extends LineLikeSeriesSpecTransformer<T, K> {
    protected _supportStack: boolean;
    protected _transformLabelSpec(spec: T): void;
    protected _transformSpecAfterMergingTheme(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): void;
}
