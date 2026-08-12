import { MarkTypeEnum } from '../../mark/interface/type';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum, SeriesMarkNameEnum } from '../interface/type';
import { BarSeries } from './bar';
import type { IBar3dSeriesSpec } from './interface';
import type { AdaptiveSpec } from '../../typings';
export declare class Bar3dSeries<T extends IBar3dSeriesSpec = IBar3dSeriesSpec> extends BarSeries<AdaptiveSpec<T, 'type'>> {
    static readonly type: string;
    type: SeriesTypeEnum;
    static readonly mark: SeriesMarkMap;
    protected _barMarkName: SeriesMarkNameEnum;
    protected _barMarkType: MarkTypeEnum;
    static readonly transformerConstructor: any;
    readonly transformerConstructor: any;
}
export declare const registerBar3dSeries: () => void;
