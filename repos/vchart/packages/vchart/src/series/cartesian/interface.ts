import type { ISeriesSpec } from '../../typings/spec/common';
import type { DirectionType } from '../../typings';
import type { ILabelSpec } from '../../component/label/interface';

export interface ICartesianSeriesSpec extends ISeriesSpec {
  /**
   * direction
   * row means layout by rows，col means layout by columns
   */
  direction?: DirectionType;
  /**
   * x轴字段
   */
  xField?: string | string[];
  /**
   * 用于区间数据，声明区间末尾的数据字段。
   */
  x2Field?: string;
  // 因为存在 direction
  /**
   * y轴字段
   * 运行双轴都为离散，连续。所以 yField 也可以像 xField 一样支持多维度
   */
  yField?: string | string[];
  /**
   * 用于区间数据，声明区间末尾的数据字段。
   */
  y2Field?: string;

  /**
   * z轴字段
   * 用于3d散点图等
   */
  zField?: string | string[];

  /** 是否将数据按照数轴排序
   * @default false
   * @since 1.3.0
   */
  sortDataByAxis?: boolean;
}

export interface ICartesianSeriesTheme {
  label?: Partial<ILabelSpec>;
}
