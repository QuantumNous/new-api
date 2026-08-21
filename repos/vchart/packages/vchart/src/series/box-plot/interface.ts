import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkProgressiveConfig } from '../../mark/interface';
import type {
  DirectionType,
  IBoxPlotMarkSpec,
  IOutlierMarkSpec,
  IMarkSpec,
  IMarkTheme,
  ISymbolMarkSpec
} from '../../typings';
import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { SeriesMarkNameEnum } from '../interface/type';

export interface IBoxPlotSeriesSpec
  extends Omit<ICartesianSeriesSpec, 'xField' | 'yField' | 'direction'>,
    // TODO: 补充动画类型 @chengda
    IAnimationSpec<SeriesMarkNameEnum.boxPlot, string>,
    IMarkProgressiveConfig {
  /** 系列类型 */
  type: 'boxPlot';
  direction?: DirectionType;
  /**
   *x轴字段（direction=vertical时生效）
   */
  xField?: string | string[];
  /**
   *y轴字段（direction=horizontal时生效）
   */
  yField?: string | string[];
  /**
   *最小值字段
   */
  minField?: string;
  /**
   *最大值字段
   */
  maxField?: string;
  /**
   *q1字段
   */
  q1Field?: string;
  /**
   *中位数字段
   */
  medianField?: string;
  /**
   *q3字段
   */
  q3Field?: string;
  /**
   * 异常值字段
   */
  outliersField?: string;
  /**
   * 图元配置
   */
  [SeriesMarkNameEnum.boxPlot]?: IMarkSpec<IBoxPlotMarkSpec>;
  /**
   * 异常值图元配置
   * @since 2.0.10
   */
  [SeriesMarkNameEnum.outlier]?: IMarkSpec<ISymbolMarkSpec>;
  /**
   * 异常值样式配置
   * @todo 将在未来版本中废弃，请使用 outlier 配置项代替
   */
  outliersStyle?: IOutlierMarkSpec;

  /**
   * 宽度，可以设置绝对的像素值，也可以使用百分比（如 '10%'）
   * 1. number 类型，表示像素值
   * 2. string 类型，百分比用法，如 '10%'，该值为对应最后一个分组字段对应的 scale 的 bandWidth 占比
   * @since 2.0.10
   */
  boxWidth?: number | string;
  /**
   * 最小宽度，可以设置绝对的像素值，也可以使用百分比（如 '10%'）
   * 1. number 类型，表示像素值
   * 2. string 类型，百分比用法，如 '10%'，该值为对应最后一个分组字段对应的 scale 的 bandWidth 占比
   * @since 2.0.10
   */
  boxMinWidth?: number | string;
  /**
   * 最大宽度，可以设置绝对的像素值，也可以使用百分比（如 '10%'）
   * 1. number 类型，表示像素值
   * 2. string 类型，百分比用法，如 '10%'，该值为对应最后一个分组字段对应的 scale 的 bandWidth 占比
   * @since 2.0.10
   */
  boxMaxWidth?: number | string;

  /**
   * 分组箱线图中各个分组内的间距，可以设置绝对的像素值，也可以使用百分比（如 '10%'）。
   * 1. number 类型，表示像素值
   * 2. string 类型，百分比用法，如 '10%'，该值为对应最后一个分组字段对应的 scale 的 bandWidth 占比
   * @since 2.0.10
   */
  boxGapInGroup?: number | string | (number | string)[];
}

export interface IBoxPlotSeriesTheme extends ICartesianSeriesTheme {
  [SeriesMarkNameEnum.boxPlot]?: Partial<IMarkTheme<IBoxPlotMarkSpec>>;
}
