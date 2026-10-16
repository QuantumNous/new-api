import type { IArcMarkSpec, IPathMarkSpec } from '../../typings';
import type { IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec';
import type { IAnimationSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILabelSpec } from '../../component/label/interface';

export type VennMark = 'circle' | 'overlap';

export type VennAppearPreset = 'growIn' | 'fadeIn' | 'scaleIn';
export interface IVennSeriesSpec extends ISeriesSpec, IAnimationSpec<VennMark, VennAppearPreset> {
  type: 'venn';
  /**
   * 类别字段
   */
  categoryField?: string;
  /**
   * 权重字段
   */
  valueField: string;

  /**
   * 圆形图元配置
   */
  [SeriesMarkNameEnum.circle]?: IMarkSpec<IArcMarkSpec>;
  /**
   * 重叠部分图元配置
   */
  [SeriesMarkNameEnum.overlap]?: IMarkSpec<IPathMarkSpec>;
  /**
   * 圆形图元标签配置
   */
  [SeriesMarkNameEnum.label]?: Omit<ILabelSpec, 'position'>;
  /**
   * 重叠部分图元标签配置
   */
  [SeriesMarkNameEnum.overlapLabel]?: Omit<ILabelSpec, 'position'>;
}

export interface IVennSeriesTheme {
  /**
   * 圆形图元配置
   */
  [SeriesMarkNameEnum.circle]?: Partial<IMarkTheme<IArcMarkSpec>>;
  /**
   * 重叠部分图元配置
   */
  [SeriesMarkNameEnum.overlap]?: Partial<IMarkTheme<IPathMarkSpec>>;
  /**
   * 圆形图元标签配置
   */
  [SeriesMarkNameEnum.label]?: Omit<ILabelSpec, 'position'>;
  /**
   * 重叠部分图元标签配置
   */
  [SeriesMarkNameEnum.overlapLabel]?: Omit<ILabelSpec, 'position'>;
}
