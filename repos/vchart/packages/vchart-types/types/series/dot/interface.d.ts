import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IFormatMethod, IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ISymbolMarkSpec, IRuleMarkSpec, ITextMarkSpec, ConvertToMarkStyleSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
interface ISequenceLabel {
    visible?: boolean;
    formatMethod?: IFormatMethod<[text: string | string[], datum?: any]>;
    style?: Omit<ConvertToMarkStyleSpec<ITextMarkSpec>, 'visible'>;
}
interface ISequenceGrid {
    visible?: boolean;
    background?: {
        fill?: string;
        fillOpacity?: number;
    };
    style?: Omit<ConvertToMarkStyleSpec<IRuleMarkSpec>, 'visible'>;
}
export interface IDotSeriesSpec extends ICartesianSeriesSpec {
    type: 'dot';
    seriesGroupField?: string;
    dotTypeField?: string;
    titleField?: string;
    subTitleField?: string;
    highLightSeriesGroup?: string;
    name: string;
    [SeriesMarkNameEnum.dot]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.title]?: ISequenceLabel;
    [SeriesMarkNameEnum.symbol]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.subTitle]?: ISequenceLabel;
    [SeriesMarkNameEnum.grid]?: ISequenceGrid;
    leftAppendPadding?: number;
    clipHeight?: number;
}
export interface IDotSeriesTheme extends ICartesianSeriesTheme {
    [SeriesMarkNameEnum.dot]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
    [SeriesMarkNameEnum.symbol]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
    [SeriesMarkNameEnum.title]?: ISequenceLabel;
    [SeriesMarkNameEnum.subTitle]?: ISequenceLabel;
}
export {};
