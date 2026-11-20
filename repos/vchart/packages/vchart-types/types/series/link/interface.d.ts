import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ILineMarkSpec, ISymbolMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { DataView } from '@visactor/vdataset';
import type { IDotSeriesSpec } from '../dot/interface';
export interface ILinkSeriesSpec extends ICartesianSeriesSpec, ILinkSeriesSpecFromDot {
    type: 'link';
    fromField: string;
    toField: string;
    dotSeriesIndex: number;
    dotTypeField?: string;
    [SeriesMarkNameEnum.link]?: IMarkSpec<ILineMarkSpec>;
}
type ILinkSeriesSpecFromDot = {
    dataDot?: DataView;
    dotSeriesSpec?: IDotSeriesSpec;
    leftAppendPadding?: number;
    clipHeight?: number;
};
export interface ILinkSeriesTheme extends ICartesianSeriesTheme {
    [SeriesMarkNameEnum.link]?: Partial<IMarkTheme<ILineMarkSpec>>;
    [SeriesMarkNameEnum.arrow]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
}
export {};
