import type { Datum } from '../../../../typings/common';
import type { IComponent } from '../../../interface';
import type {
  IDataPointSpec,
  IDataPos,
  IDataPosCallback,
  IMarkerSpec,
  IMarkerSupportSeries,
  IMarkerSymbol,
  MarkerPositionPoint,
  OffsetPoint
} from '../../interface';
import type { IMarkPointTheme } from './theme';
import type { BaseMarkerAnimation, MarkPointAnimationType } from '@visactor/vrender-components';

export type IMarkPoint = IComponent;
/**
 * 辅助点、点标注相关配置
 */
export type IMarkPointSpec = IMarkerSpec &
  // 标注目标: 笛卡尔坐标系
  (| IMarkPointXYSpec
    /** 标注目标: 极坐标系
     * @since 1.11.0
     */
    | IMarkPointAngleRadiusSpec
    /** 标注目标: 地理坐标系
     * @since 1.11.0
     */
    | IMarkPointGeoNameSpec
    // 标注目标：数据元素
    | IMarkPointCoordinateSpec
    | IMarkPointPositionsSpec
  ) &
  IMarkPointTheme<IMarkerSymbol> &
  /**
   * 动画配置
   * @since 1.11.0
   */
  BaseMarkerAnimation<MarkPointAnimationType>;

export type IMarkPointXYSpec = {
  /**
   * 参考点在 y 轴上位置，可以配置参考线在 y 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * 可以将 y 配置为 '15%' 百分比的形式，表示该位置位于  region 纵轴（从上到下）的百分之 15 位置处。
   */
  y: IDataPos | IDataPosCallback;
  /**
   * 参考点在 x 轴的起点位置，可以配置 x 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * 可以将 x 配置为 '15%' 百分比的形式，表示该位置位于 region 横轴（从左往右）的百分之 15 位置处。
   */
  x: IDataPos | IDataPosCallback;
};

export type IMarkPointAngleRadiusSpec = {
  /**
   * 极坐标系下,  angle 轴上位置，可以配置参考线在 angle 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  angle: IDataPos | IDataPosCallback;
  /**
   * 极坐标系下, radius 轴上位置，可以配置参考线在 angle 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  radius: IDataPos | IDataPosCallback;
};

export type IMarkPointGeoNameSpec = {
  /**
   * 地理坐标系下, 地理区域的名称。
   * @since 1.11.0
   */
  areaName: string | IDataPosCallback;
};

export type IMarkPointCoordinateSpec = {
  /**
   * 指定数据点的参考线。基于指定数据点进行参考线的绘制，可以对数据点进行数据处理
   * `coordinate` 自 1.12.0 版本开始支持回调函数
   */
  coordinate: IDataPointSpec | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec);
  /**
   * 对每个数据点转化后的画布坐标点进行偏移，该偏移值可以是像素值，也可以是 string 类型，如 '20%' 代表百分比
   * 每个元素对应一个坐标点的偏移量
   * @since 1.7.3
   */
  coordinatesOffset?: OffsetPoint;
};

/**
 * 指定坐标点的参考线。基于指定坐标进行参考线的绘制
 */
export type IMarkPointPositionsSpec = {
  /**
   * `position` 自 1.12.0 版本开始支持回调函数
   */
  position: MarkerPositionPoint | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => MarkerPositionPoint);
  /**
   * 是否为相对 region 的坐标，默认为 false，即相对画布的坐标
   * @default false
   * @since 1.7.0
   */
  regionRelative?: boolean;
};
