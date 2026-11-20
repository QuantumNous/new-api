import { MarkTypeEnum } from '../../mark/interface/type';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import { RangeColumnSeries } from './range-column';
import type { AdaptiveSpec } from '../../typings';
import type { IRangeColumn3dSeriesSpec } from './interface';
export declare const DefaultBandWidth = 6;
export declare class RangeColumn3dSeries<T extends IRangeColumn3dSeriesSpec = IRangeColumn3dSeriesSpec> extends RangeColumnSeries<AdaptiveSpec<T, 'type'>> {
    static readonly type: string;
    type: SeriesTypeEnum;
    protected _barMarkType: MarkTypeEnum;
    protected _barName: string;
    static readonly mark: SeriesMarkMap;
}
export declare const registerRangeColumn3dSeries: () => void;
