import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec';
import type { IArcMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IRoseLikeSeriesSpec, IRoseLikeSeriesTheme } from '../polar/rose-like/interface';
import type { IArcLabelSpec } from '../pie/interface';
import type { IMultiLabelSpec } from '../../component/label/interface';

export type RoseMarks = 'rose';

export interface IRoseSeriesSpec extends IRoseLikeSeriesSpec, IAnimationSpec<RoseMarks, RoseAppearPreset> {
  type: 'rose';
  /**
   * 分类字段
   */
  categoryField: string | string[];
  /**
   * 数值字段
   */
  valueField: string | string[];
  /** 扇区样式 */
  [SeriesMarkNameEnum.rose]?: IMarkSpec<IArcMarkSpec>;
  /** 标签配置 */
  [SeriesMarkNameEnum.label]?: IMultiLabelSpec<IArcLabelSpec>;
}

export interface IRoseSeriesTheme extends IRoseLikeSeriesTheme {
  [SeriesMarkNameEnum.rose]?: Partial<IMarkTheme<IArcMarkSpec>>;
  /** 标签配置 */
  [SeriesMarkNameEnum.label]?: IArcLabelSpec;
}

export interface IRoseAnimationParams {
  innerRadius: () => number;
  growField?: 'angle' | 'radius';
}

export type RoseAppearPreset = 'growAngle' | 'growRadius' | 'fadeIn';
