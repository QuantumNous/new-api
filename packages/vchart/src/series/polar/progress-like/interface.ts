import type { IArcMarkSpec, IMarkSpec, IMarkTheme } from '../../../typings';
import type { IPolarSeriesSpec, IPolarSeriesTheme } from '../interface';

export type ProgressLikeAppearPreset = 'grow' | 'fadeIn';

export interface IProgressLikeAnimationParams {
  startAngle?: number;
}

export interface IContinuousTickData {
  index?: number;
  value: number;
}

export interface ITickMaskSpec {
  /** 单个 tick 的默认宽度，角度值 */
  angle?: number;
  /** 单个 tick 的偏移角度，角度值 */
  offsetAngle?: number;
  /** tick mask 下的图元是否强制和 tick 的边线对齐 */
  forceAlign?: boolean;
}

export interface IProgressLikeSeriesSpec extends IPolarSeriesSpec {
  /** 圆角部分是否突出（可分别设置左侧和右侧） */
  roundCap?: boolean | [boolean, boolean];

  /** 圆角半径 */
  cornerRadius?: number;

  /**
   * tick 模式显示
   * @since 1.4.0
   */
  tickMask?: Omit<IMarkSpec<IArcMarkSpec>, 'state'> & ITickMaskSpec;

  /**
   * 超出轴范围是否被裁剪（除tick模式外, 因为tick模式自带裁剪）
   * @since 1.13.9
   * @default false
   */
  clamp?: boolean;
}

export interface IProgressLikeSeriesTheme extends IPolarSeriesTheme {
  /** 圆角部分是否突出 */
  roundCap?: boolean | [boolean, boolean];

  /** 圆角半径 */
  cornerRadius?: number;

  /**
   * tick 模式显示
   * @since 1.4.0
   */
  tickMask?: Omit<IMarkTheme<IArcMarkSpec>, 'state'> & ITickMaskSpec;
}
