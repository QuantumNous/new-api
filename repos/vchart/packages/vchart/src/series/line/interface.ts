import type { IMarkSpec } from '../../typings/spec/common';
import type { ICartesianSeriesSpec } from '../cartesian/interface';
import type { ISymbolMarkSpec, ILineMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { IDataSamping, IMarkOverlap, IMarkProgressiveConfig } from '../../mark/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IMultiLabelSpec, ILabelSpec } from '../../component/label/interface';
import type { ILineLikeLabelSpec, ILineLikeSeriesTheme } from '../mixin/interface';
import type { DirectionType } from '../../typings/space';

export interface ILineAnimationParams {
  direction: DirectionType;
}

export type LineAppearPreset = 'clipIn' | 'fadeIn' | 'grow';

type LineMarks = 'point' | 'line';

export interface ILineSeriesSpec
  extends ICartesianSeriesSpec,
    IAnimationSpec<LineMarks, LineAppearPreset>,
    IMarkProgressiveConfig,
    IDataSamping,
    IMarkOverlap {
  /** 系列类型 */
  type: 'line';
  /**
   * x轴字段
   */
  xField?: string | string[];
  /**
   * y轴字段
   */
  yField?: string | string[];
  /**
   * 点图元配置
   */
  [SeriesMarkNameEnum.point]?: IMarkSpec<ISymbolMarkSpec>;
  /**
   * 线图元配置
   */
  [SeriesMarkNameEnum.line]?: IMarkSpec<ILineMarkSpec>;
  /**
   * 标签配置
   */
  [SeriesMarkNameEnum.label]?: IMultiLabelSpec<ILineLikeLabelSpec>;
  /**
   * 折线标签配置
   * @since 1.7.0
   */
  [SeriesMarkNameEnum.lineLabel]?: Omit<ILabelSpec, 'position'> & {
    position?: 'start' | 'end';
  };
  /**
   * 系列主 mark 类型配置，该配置会影响图例的展示
   * @default 'line'
   * @since 1.2.0
   */
  seriesMark?: 'line' | 'point';

  /**
   * 是否使用额外的 activePoint 显示交互点，可以在点隐藏时显示被交互的点
   * @default false
   * @since 1.3.0
   */
  activePoint?: boolean;
}

export type ILineSeriesTheme = ILineLikeSeriesTheme;
