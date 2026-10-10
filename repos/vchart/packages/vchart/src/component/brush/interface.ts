import type { FederatedPointerEvent, SymbolType } from '@visactor/vrender-core';
import type { IPolygonMarkSpec } from '../../typings';
import type { IComponent } from '../interface';
import type { IDelayType } from '../../typings/event';

export type IBrush = IComponent;

interface IBrushDataBindSpec {
  /**
   * 可刷取的regionIndex
   */
  regionIndex?: number | number[]; // 默认为所有region
  /**
   * 可刷取的regionId
   */
  regionId?: string | string[]; // 默认为所有region
  /**
   * 可刷取的seriesIndex（在可刷取的region范围内）
   */
  seriesIndex?: number | number[]; // 默认为所有系列
  /**
   * 可刷取的seriesId（在可刷取的region范围内）
   */
  seriesId?: string | string[]; // 默认为所有系列
  /**
   * 刷取联动的seriesIndex
   */
  brushLinkSeriesIndex?: number | number[]; // 默认无系列
  /**
   * 刷取联动的seriesId
   */
  brushLinkSeriesId?: string | string[]; // 默认无系列

  /**
   * 刷取后是否更新axis/dataZoom范围
   * @default false
   * @since 0.10.0
   */
  zoomAfterBrush?: boolean;
  /**
   * 刷取到空数据时, 是否更新axis/dataZoom范围
   * @default false
   * @since 1.12.2
   */
  zoomWhenEmpty?: boolean;
  /**
   * 刷取联动的axisId
   * 如果开启刷取下钻, 默认联动所有关联axis和dataZoom
   * dataZoom filterMode: 'axis'时刷取才能正常进行（filterMode: 'filter'会改变axis domain, 导致计算错误）
   * @since 0.10.0
   */
  axisId?: string | string[];
  /**
   * 刷取联动的axisIndex
   * 如果开启刷取下钻, 默认联动所有关联axis和dataZoom
   * dataZoom filterMode: 'axis'时刷取才能正常进行（filterMode: 'filter'会改变axis domain, 导致计算错误）
   * @since 0.10.0
   */
  axisIndex?: number | number[];
  /**
   * 更新dataZoom范围时, 按百分比进行范围拓展, 比如: dataZoomRangeExpand = 0.05, 则代表更新时newStart - 0.05 & newEnd + 0.05
   * @since 1.10.0
   * 原因:
   * 1) 轴的zero、nice、min、max等配置可能导致轴范围与dataZoom范围不一致）
   * 2) 散点图按照散点中心定位, 如果严格按照中心范围更新，会出现散点超出画布的现象
   */
  axisRangeExpand?: number;
  /**
   * 框选前触发事件
   * 返回false, 则阻止后续逻辑
   */
  beforeBrushChange?: (e: FederatedPointerEvent) => void | boolean;
  /**
   * 是否在框选时禁用维度 hover 事件
   * @default false
   */
  disableDimensionHoverWhenBrushing?: boolean;
}

export interface IBrushTheme {
  /**
   * brush 的框选样式
   */
  style?: Partial<IPolygonMarkSpec>;

  /**
   * 框选范围内的图元样式
   */
  inBrush?: selectedItemStyle;
  /**
   * 框选范围外的图元样式
   */
  outOfBrush?: selectedItemStyle;
  /**
   * 框选模式
   * @default 'single'
   */
  brushMode?: IBrushMode;
  /**
   * 框选类型
   * @default 'rect'
   */
  brushType?: IBrushType;
  /**
   * 是否可被平移
   * @default true
   */
  brushMoved?: boolean;
  /**
   * brushMode为'single'时，是否单击清除选框
   * @default true
   */
  removeOnClick?: boolean;
  /**
   * 事件触发延迟类型
   * @default 'throttle'
   */
  delayType?: IDelayType;
  /**
   * 事件触发延迟时长
   * @default 10
   */
  delayTime?: number;
  /**
   * brush选框的大小阈值
   * @default 5
   * @since 1.2.0
   */
  sizeThreshold?: number;
  /**
   * 不需要被brush操作的mark类型
   * @since 1.13.9
   */
  markTypeFilter?: string[];
  /**
   * 自定义brush事件, 触发时机: 框选结束
   * 返回true, 则清空brush
   * @since 1.13.9
   */
  onBrushEnd?: (e: any) => boolean;
}

export interface IBrushSpec extends IBrushTheme, IBrushDataBindSpec {
  /** 组件 id */
  id?: string;
  /**
   * 组件可见性
   * @default true
   */
  visible?: boolean;
  /**
   * 是否更新图元状态
   * 关闭时, brush 事件不会触发图元状态更新, 优化缩放场景下的性能
   * @default true
   * @since 1.13.13
   */
  updateElementsState?: boolean;
}

export type IBrushType = 'x' | 'y' | 'rect' | 'polygon';
export type IBrushMode = 'single' | 'multiple';

export type selectedItemStyle = {
  /**
   * 图元的图形类别
   */
  symbol?: SymbolType;
  /**
   * 图元的大小
   */
  symbolSize?: number;
  /**
   * 图元的颜色
   */
  color?: string;
  /**
   * 图元的颜色透明度
   */
  colorAlpha?: number;
} & Partial<IPolygonMarkSpec>;

export type BrushInteractiveRangeAttr = {
  interactiveRange: {
    minY: number;
    maxY: number;
    minX: number;
    maxX: number;
  };
  xRange: [number, number];
  yRange: [number, number];
};
