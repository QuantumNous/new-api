import type { IAnimationSpec } from '../../animation/spec';
import type { IArcMarkSpec, ITextMarkSpec, IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IPolarSeriesTheme } from '../polar/interface';
export type CirclePackingMark = 'leaf' | 'nonLeaf' | 'label' | 'nonLeafLabel';
export type CirclePackingAppearPreset = 'growIn' | 'fadeIn';
export interface ICirclePackingSeriesSpec extends ISeriesSpec, IAnimationSpec<CirclePackingMark, CirclePackingAppearPreset> {
    type: 'circlePacking';
    categoryField: string;
    valueField: string;
    layoutPadding?: number | number[];
    [SeriesMarkNameEnum.label]?: IMarkSpec<ITextMarkSpec>;
    [SeriesMarkNameEnum.circlePacking]?: IMarkSpec<IArcMarkSpec>;
    drill?: boolean;
    drillField?: string;
}
export interface ICirclePackingSeriesTheme extends Omit<IPolarSeriesTheme, 'label'> {
    layoutPadding?: number | number[];
    [SeriesMarkNameEnum.label]?: IMarkTheme<ITextMarkSpec>;
    [SeriesMarkNameEnum.circlePacking]?: IMarkTheme<IArcMarkSpec>;
}
