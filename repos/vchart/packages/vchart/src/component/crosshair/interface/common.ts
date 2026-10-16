import type { Dict } from '@visactor/vutils';
import type { IPadding, StringOrNumber } from '../../../typings';
import type { IAxis } from '../../axis/interface';
import type { LineCrosshair, RectCrosshair, Tag } from '@visactor/vrender-components';
import type { IGroup, IRichTextGraphicAttribute, IText, ITextGraphicAttribute } from '@visactor/vrender-core';

export type AxisCurrentValueMap = Map<
  number,
  {
    datum: StringOrNumber;
    axis: IAxis;
    [key: string]: any;
  }
>;

export type IBound = { x1: number; y1: number; x2: number; y2: number };
export type IAxisInfo<T> = Map<number, IBound & { axis: T }>;

export interface IHair {
  /** 是否展示 crosshair 辅助图形 */
  visible: boolean;
  /** 类型 */
  type: 'rect' | 'line';
  /** 样式 */
  style?: Dict<any>;
  label?: {
    /** 文本是否可见 */
    visible: boolean;
    /** 格式化函数 */
    formatMethod?: (text: StringOrNumber | string[], position: string) => string | string[];
    /**
     * 格式化模板
     * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
     * @since 1.10.0
     */
    formatter?: string | string[];
    /** 文本样式 */
    textStyle?: Dict<any>;
    minWidth?: number;
    maxWidth?: number;
    padding?: IPadding | number | number[];
    panel?: Dict<any>;
    zIndex?: number;
    /**
     * 文本是否跟随轴标签的角度旋转
     * default: false
     * @since 1.13.12
     */
    syncAxisLabelAngle?: boolean;
  };
  /**
   * 极坐标系样式
   */
  smooth?: boolean;
}

export interface IHairRadius extends IHair {
  smooth?: boolean;
}

export interface ICrosshairLabelInfo {
  visible: boolean;
  text: StringOrNumber;
  dx?: number;
  dy?: number;
  x?: number;
  y?: number;
  offset?: number;
  defaultFormatter?: (value: StringOrNumber) => StringOrNumber;
}

export interface ICrosshairInfo {
  /**
   * croosshair 的大小，xField 对应了crosshair图形的高度，yField 对应了crosshair图形的宽度
   */
  coordRange: [number, number];
  sizeRange: [number, number];
  coord: number;
  labels: Record<string, ICrosshairLabelInfo>;
  labelsTextStyle?: Record<string, Partial<ITextGraphicAttribute> | Partial<IRichTextGraphicAttribute>>;
  visible: boolean;
  _isCache?: boolean;
  axis: IAxis;
  axisLabel?: IText;
  /**
   * 半径轴对应的crosshair，当crosshair类型为多边形的时候，多边形的边数
   */
  sides?: number;
}

export interface CrossHairStateItem {
  /**
   * 坐标对应的key，xField对应了'x'，yField对应了'y'
   */
  coordKey: string;
  /**
   * 另一个轴对应的key，xField对应了'y'，yField对应了'x'
   */
  anotherAxisKey: string;
  /**
   * 记录当前crosshair对应的轴组件和位置信息
   */
  currentValue: AxisCurrentValueMap;
  /**
   * crosshair组件对应的公共的图形属性配置
   */
  attributes?: IHair | undefined;
  /**
   * 记录当前crosshair的信息，用于crosshair组件的更新
   */
  cacheInfo?: ICrosshairInfo | undefined;
  /**
   * crosshair组件的实例
   */
  crosshairComp?: LineCrosshair | RectCrosshair | IGroup;
  /**
   * crosshair组件的文本实例
   */
  labelsComp?: Record<string, Tag>;
  /**
   * 当前轴对应的band大小
   */
  bandSize?: number;
  /**
   * 当前轴对应的band偏移量
   */
  offsetSize?: number;
}

export type CrossHairStateByField = Record<string, CrossHairStateItem>;
