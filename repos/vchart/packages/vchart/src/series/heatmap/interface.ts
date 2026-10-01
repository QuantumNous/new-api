import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IRectMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { ILabelSpec } from '../../component/label/interface';
import type { IMarkProgressiveConfig } from '../../mark/interface';
import type { SeriesMarkNameEnum } from '../interface/type';

export type HeatmapAppearPreset = 'fadeIn';

type HeatmapMarks = 'cell' | 'background' | 'label';

export interface IHeatmapSeriesSpec
  extends ICartesianSeriesSpec,
    IAnimationSpec<HeatmapMarks, HeatmapAppearPreset>,
    IMarkProgressiveConfig {
  /**
   *  系列类型
   */
  type: 'heatmap';

  /** 值 field */
  valueField?: string;

  /** 图元配置 */
  [SeriesMarkNameEnum.cell]?: IMarkSpec<IRectMarkSpec>;

  /** 图元背景配置 */
  [SeriesMarkNameEnum.cellBackground]?: IMarkSpec<IRectMarkSpec>;

  /** 标签配置*/
  [SeriesMarkNameEnum.label]?: ILabelSpec & {
    /** 标签位置 */
    position?: 'inside' | 'inside-top' | 'inside-bottom' | 'inside-right' | 'inside-left';
  };
}

export interface IHeatmapSeriesTheme extends ICartesianSeriesTheme {
  [SeriesMarkNameEnum.cell]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [SeriesMarkNameEnum.cellBackground]?: Partial<IMarkTheme<IRectMarkSpec>>;
}
