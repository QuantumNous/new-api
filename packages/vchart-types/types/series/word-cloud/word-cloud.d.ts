import { SeriesTypeEnum } from '../interface/type';
import type { IWordCloudSeriesSpec } from './interface';
import { BaseWordCloudSeries } from './base';
export declare class WordCloudSeries<T extends IWordCloudSeriesSpec = IWordCloudSeriesSpec> extends BaseWordCloudSeries<T> {
    static readonly type: string;
    type: SeriesTypeEnum;
}
export declare const registerWordCloudSeries: () => void;
export declare const registerWordCloudShapeSeries: () => void;
