import { MarkTypeEnum } from '../../mark/interface/type';
import type { IArcSeries, SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { IPie3dSeriesSpec } from './interface';
import { BasePieSeries } from './pie';
export declare class Pie3dSeries<T extends IPie3dSeriesSpec = IPie3dSeriesSpec> extends BasePieSeries<T> implements IArcSeries {
    static readonly type: string;
    type: SeriesTypeEnum;
    protected _pieMarkName: SeriesMarkNameEnum;
    protected _pieMarkType: MarkTypeEnum;
    static readonly mark: SeriesMarkMap;
    protected _angle3d: number;
    setAttrFromSpec(): void;
    initMarkStyle(): void;
}
export declare const registerPie3dSeries: () => void;
