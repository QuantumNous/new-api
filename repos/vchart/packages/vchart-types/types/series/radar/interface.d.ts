import type { IAnimationSpec } from '../../animation/spec';
import type { IMultiLabelSpec } from '../../component/label/interface';
import type { IMarkOverlap, IMarkProgressiveConfig } from '../../mark/interface';
import type { Maybe } from '../../typings/common';
import type { IPoint } from '../../typings/coordinate';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IAreaMarkSpec, ILineMarkSpec, ISymbolMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILineLikeLabelSpec, ILineLikeSeriesTheme } from '../mixin/interface';
import type { IRoseLikeSeriesSpec, IRoseLikeSeriesTheme } from '../polar/rose-like/interface';
export interface IRadarAnimationParams {
    center: () => Maybe<IPoint>;
    radius: () => number;
    startAngle: number;
}
export type RadarAppearPreset = 'grow' | 'fadeIn' | 'clipIn';
type RadarMarks = 'point' | 'line' | 'area';
export interface IRadarSeriesSpec extends IRoseLikeSeriesSpec, IAnimationSpec<RadarMarks, RadarAppearPreset>, IMarkProgressiveConfig, IMarkOverlap {
    type: 'radar';
    [SeriesMarkNameEnum.point]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.line]?: IMarkSpec<ILineMarkSpec>;
    [SeriesMarkNameEnum.area]?: IMarkSpec<IAreaMarkSpec>;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<ILineLikeLabelSpec>;
    seriesMark?: 'point' | 'line' | 'area';
    activePoint?: boolean;
}
export interface IRadarSeriesTheme extends IRoseLikeSeriesTheme, ILineLikeSeriesTheme {
    [SeriesMarkNameEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
}
export {};
