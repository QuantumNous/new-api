import type { IAnimationSpec } from '../../../animation/spec';
import type { DirectionType } from '../../../typings';
import type { IMarkSpec, IMarkTheme } from '../../../typings/spec/common';
import type { IRectMarkSpec } from '../../../typings/visual';
import type { SeriesMarkNameEnum } from '../../interface/type';
import type { IProgressSeriesSpec } from '../interface';

export interface ILinearProgressAnimationParams {
  direction: DirectionType;
}

export type LinearProgressAppearPreset = 'grow' | 'fadeIn';

export interface ILinearProgressSeriesSpec
  extends IProgressSeriesSpec,
    // TODO: 补充MarkName类型 @liupei
    IAnimationSpec<SeriesMarkNameEnum.progress | SeriesMarkNameEnum.track, LinearProgressAppearPreset> {
  type: 'linearProgress';
  /**
   * coordinate: 'cartesian'
   * x轴字段
   */
  xField: string | string[];
  /**
   * y轴字段
   * 因为存在 direction，运行双轴都为离散，连续。所以 yField 也可以像 xField 一样支持多维度
   */
  yField: string | string[];

  /**
   * 方向
   * @default Direction.horizontal
   */
  direction?: DirectionType;

  /**
   * 进度条宽度
   * 以像素值(px)为单位
   */
  bandWidth?: number;

  /**
   * 超出轴范围是否被裁剪
   * @since 1.13.9
   * @default false
   */
  clamp?: boolean;

  /**
   * 进度条样式
   * TODO: 支持百分比作为padding, 类型为string
   */
  [SeriesMarkNameEnum.progress]?: IMarkSpec<IRectMarkSpec> & {
    /** 进度条上侧 padding（水平生效） */
    topPadding?: number;
    /** 进度条下侧 padding（水平生效） */
    bottomPadding?: number;
    /** 进度条左侧 padding（垂直生效） */
    leftPadding?: number;
    /** 进度条右侧 padding（垂直生效） */
    rightPadding?: number;
  };

  /** 背景条样式 */
  [SeriesMarkNameEnum.track]?: IMarkSpec<IRectMarkSpec>;
}

export interface ILinearProgressSeriesTheme {
  /**
   * 进度条宽度
   * 以像素值(px)为单位
   */
  bandWidth?: number;
  /**
   * 进度条样式
   */
  [SeriesMarkNameEnum.progress]?: Partial<IMarkTheme<IRectMarkSpec>>;
  /**
   * 背景条样式
   */
  [SeriesMarkNameEnum.track]?: Partial<IMarkTheme<IRectMarkSpec>>;
}
