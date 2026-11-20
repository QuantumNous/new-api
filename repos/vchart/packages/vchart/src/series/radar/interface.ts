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

export interface IRadarSeriesSpec
  extends IRoseLikeSeriesSpec,
    IAnimationSpec<RadarMarks, RadarAppearPreset>,
    IMarkProgressiveConfig,
    IMarkOverlap {
  type: 'radar';

  /**
   * 点图元配置
   */
  [SeriesMarkNameEnum.point]?: IMarkSpec<ISymbolMarkSpec>;
  /**
   * 线图元配置
   */
  [SeriesMarkNameEnum.line]?: IMarkSpec<ILineMarkSpec>;
  /**
   * 面积图元配置
   */
  [SeriesMarkNameEnum.area]?: IMarkSpec<IAreaMarkSpec>;
  /**
   * 标签配置
   */
  [SeriesMarkNameEnum.label]?: IMultiLabelSpec<ILineLikeLabelSpec>;
  /**
   * 系列主 mark 类型配置，该配置会影响图例的展示
   * @default 'area'
   * @since 1.2.0
   */
  seriesMark?: 'point' | 'line' | 'area';

  /**
   * 是否使用额外的 activePoint 显示交互点，可以在点隐藏时显示被交互的点
   * @default false
   * @since 1.3.0
   */
  activePoint?: boolean;
}

export interface IRadarSeriesTheme extends IRoseLikeSeriesTheme, ILineLikeSeriesTheme {
  /**
   * 面积图元的主题样式配置
   */
  [SeriesMarkNameEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
}
