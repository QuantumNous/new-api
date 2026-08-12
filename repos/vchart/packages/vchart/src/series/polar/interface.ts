import type { ISeriesSpec } from '../../typings/spec/common';

export interface IPolarSeriesSpec extends ISeriesSpec {
  /**
   * 中心点 x 坐标
   * @since 1.11.2 支持百分比字符串
   **/
  centerX?: number | string;
  /**
   * 中心点 y 坐标
   * @since 1.11.2 支持百分比字符串
   **/
  centerY?: number | string;

  /**
   * 扇区外半径
   * @default 0.6
   */
  outerRadius?: number;

  /**
   * 扇区内半径
   */
  innerRadius?: number;

  /** 扇区起始角度 */
  startAngle?: number;
  /** 扇区结束角度 */
  endAngle?: number;

  /** 类别字段 */
  categoryField?: string | string[];

  /** 数值字段 */
  valueField?: string | string[];

  /**
   * @deprecated 请使用 `valueField`
   */
  radiusField?: string | string[];

  /**
   * @deprecated 请使用 `categoryField`
   */
  angleField?: string | string[];

  /**
   * 扇区半径
   * @default 0.6
   * @deprecated use outerRadius instead
   */
  radius?: number;

  /** 是否将数据按照数轴排序
   * @default false
   * @since 1.3.0
   */
  sortDataByAxis?: boolean;
}

export interface IPolarSeriesTheme {
  /**
   * 外径
   * @deprecated use outerRadius instead
   */
  radius?: number;
  /**
   * 外径，外半径
   */
  outerRadius?: number;
  /**
   * 内径，内半径
   */
  innerRadius?: number;
  /**
   * 起始角度
   */
  startAngle?: number;
  /**
   * 结束角度
   */
  endAngle?: number;
}
