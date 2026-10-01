import type { BaseMarkerAnimation, CommonMarkAreaAnimationType } from '@visactor/vrender-components';
import type { IComponent } from '../../../interface';
import type {
  IMarkerPositionsSpec,
  IDataPointSpec,
  IDataPos,
  IMarkerSpec,
  IDataPosCallback,
  IMarkerCrossSeriesSpec,
  OffsetPoint,
  IMarkerSupportSeries
} from '../../interface';
import type { IMarkAreaTheme } from './theme';
import type { Datum } from '../../../../typings/common';

export type IMarkArea = IComponent;

export type IRegressType = 'regression';

/**
 * 面积标注、区块标注、辅助区块相关配置
 */
export type IMarkAreaSpec = IMarkerSpec &
  /**
   * 标注目标：笛卡尔坐标系坐标空间
   */
  (| IMarkAreaXSpec
    | IMarkAreaYSpec
    | IMarkAreaXYSpec
    /**
     * 标注目标：极坐标系坐标空间
     * @since 1.11.0
     */
    | IMarkAreaAngleSpec
    | IMarkAreaRadiusSpec
    | IMarkAreaAngleRadiusSpec
    /**
     * 标注目标：数据元素
     */
    | IMarkAreaCoordinateSpec
    | IMarkerPositionsSpec
  ) &
  IMarkAreaTheme &
  /**
   * 动画配置
   * @since 1.11.0
   */
  BaseMarkerAnimation<CommonMarkAreaAnimationType>; // 标注目标：任意位置

export interface IMarkAreaXSpec extends IMarkerCrossSeriesSpec {
  /**
   * x轴上的参考线。可以配置参考线在x轴上的值，或者聚合计算类型
   * 可以将 x 配置为 '15%' 百分比的形式，用于表示将 x 绘制在 marker 所在 region 横轴（从左往右）的百分之 15 位置处
   */
  x: IDataPos | IDataPosCallback;
  /**
   * 设置x轴上的第二个值，如果同时设置了x 和 x1，会形成一个范围
   */
  x1: IDataPos | IDataPosCallback;
}

export interface IMarkAreaYSpec extends IMarkerCrossSeriesSpec {
  /**
   * y轴上的参考线。可以配置参考线在y轴上的值，或者聚合计算类型
   * 可以将 y 配置为 '15%' 百分比的形式，用于表示将 y 绘制在 marker 所在 region 纵轴（从上到下）的百分之 15 位置处
   */
  y: IDataPos | IDataPosCallback;
  /**
   * 设置y轴上的第二个值，如果同时设置了y 和 y1，会形成一个范围
   */
  y1: IDataPos | IDataPosCallback;
}

export interface IMarkAreaXYSpec extends IMarkerCrossSeriesSpec {
  /**
   * x轴上的参考线。可以配置参考线在x轴上的值，或者聚合计算类型
   * 可以将 x 配置为 '15%' 百分比的形式，用于表示将 x 绘制在 marker 所在 region 横轴（从左往右）的百分之 15 位置处
   */
  x: IDataPos | IDataPosCallback;
  /**
   * 设置x轴上的第二个值，如果同时设置了x 和 x1，会形成一个范围
   */
  x1: IDataPos | IDataPosCallback;
  /**
   * y轴上的参考线。可以配置参考线在y轴上的值，或者聚合计算类型
   * 可以将 y 配置为 '15%' 百分比的形式，用于表示将 y 绘制在 marker 所在 region 纵轴（从上到下）的百分之 15 位置处
   */
  y: IDataPos | IDataPosCallback;
  /**
   * 设置y轴上的第二个值，如果同时设置了y 和 y1，会形成一个范围
   */
  y1: IDataPos | IDataPosCallback;
}

export interface IMarkAreaAngleSpec extends IMarkerCrossSeriesSpec {
  /**
   * 极坐标系下, angle 轴上位置，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  angle: IDataPos | IDataPosCallback;
  /**
   * 极坐标系下, angle 轴上位置，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  angle1: IDataPos | IDataPosCallback;
}

export interface IMarkAreaRadiusSpec extends IMarkerCrossSeriesSpec {
  /**
   * 极坐标系下,  radius 轴上位置， 或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  radius: IDataPos | IDataPosCallback;
  /**
   * 极坐标系下,  radius 轴上位置， 或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  radius1: IDataPos | IDataPosCallback;
}

export interface IMarkAreaAngleRadiusSpec extends IMarkerCrossSeriesSpec {
  /**
   * 极坐标系下, angle 轴上位置，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  angle: IDataPos | IDataPosCallback;
  /**
   * 极坐标系下, angle 轴上位置，或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  angle1: IDataPos | IDataPosCallback;
  /**
   * 极坐标系下,  radius 轴上位置， 或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  radius: IDataPos | IDataPosCallback;
  /**
   * 极坐标系下,  radius 轴上位置， 或者聚合计算类型，或者以回调的形式通过数据自行计算。
   * @since 1.11.0
   */
  radius1: IDataPos | IDataPosCallback;
}

export type IMarkAreaCoordinateSpec = {
  /**
   * 指定数据点的参考线。基于指定数据点进行参考线的绘制，可以对数据点进行数据处理
   * `coordinates` 自 1.12.0 版本开始支持回调函数
   */
  coordinates: IDataPointSpec[] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec[]);

  /**
   * 对每个数据点转化后的画布坐标点进行偏移，该偏移值可以是像素值，也可以是 string 类型，如 '20%' 代表百分比
   * 每个元素对应一个坐标点的偏移量
   * @since 1.7.3
   */
  coordinatesOffset?: OffsetPoint[];
};
