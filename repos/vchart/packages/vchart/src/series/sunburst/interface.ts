import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec';
import type { SunburstLabelConfig } from '@visactor/vlayouts';
import type { SunburstAppearPreset, SunburstMark } from './animation/interface';
import type { IArcMarkSpec, ITextMarkSpec } from '../../typings';
import type { IPolarSeriesTheme } from '../polar/interface';
import type { SeriesMarkNameEnum } from '../interface/type';

export interface ISunburstSeriesSpec
  extends Omit<ISeriesSpec, 'data'>,
    IAnimationSpec<SunburstMark, SunburstAppearPreset> {
  type: 'sunburst';

  /**
   * 分类字段
   * @requires
   */
  categoryField: string;

  /**
   * 权重字段
   * @requires
   */
  valueField: string;

  /**
   * 旭日图中心点, x坐标.
   * @default 正中心
   */
  centerX?: number;

  /**
   * 旭日图中心点, y坐标.
   * @default 正中心
   */
  centerY?: number;

  /**
   * 旭日图中心点, x坐标偏移量.
   * @default 0
   */
  offsetX?: number;

  /**
   * 旭日图中心点, y坐标偏移量.
   * @default 0
   */
  offsetY?: number;

  /**
   * 起始角度
   * @default -90
   */
  startAngle?: number;

  /**
   * 终止角度
   * @default startAngle + 360
   */
  endAngle?: number;

  /**
   * 扇区半径
   * @default 0
   * @description 最内层
   */
  innerRadius?: number | number[];

  /**
   * 扇区外半径
   * @default 1
   * @description 最外层
   */
  outerRadius?: number | number[];

  /**
   * 层级间隔
   * @default 0
   * @description 对所有层生效
   */
  gap?: number | number[];

  /**
   * label布局相关参数
   */
  labelLayout?: SunburstLabelConfig | (SunburstLabelConfig | null)[];

  /**
   * 自动隐藏密集标签
   */
  labelAutoVisible?: LabelAutoVisibleType;

  /**
   * 下钻配置
   * @default false
   * @description 下钻功能开关
   */
  drill?: boolean;

  /**
   * 钻取字段的field
   * @default DEFAULT_DATA_KEY
   * @description 通过API进行钻取, 需要此配置项.
   */
  drillField?: string;

  /**
   * 标签配置
   * @description 对所有层生效
   */
  [SeriesMarkNameEnum.label]?: IMarkSpec<ITextMarkSpec>;

  /**
   * 图元配置
   */
  [SeriesMarkNameEnum.sunburst]?: IMarkSpec<IArcMarkSpec>;
}

export interface ISunburstSeriesTheme extends Omit<IPolarSeriesTheme, 'label' | 'innerRadius' | 'outerRadius'> {
  startAngle?: number;
  endAngle?: number;
  innerRadius?: number | number[];
  outerRadius?: number | number[];
  gap?: number | number[];
  labelLayout?: SunburstLabelConfig | SunburstLabelConfig[];
  [SeriesMarkNameEnum.label]?: IMarkTheme<ITextMarkSpec>;
  [SeriesMarkNameEnum.sunburst]?: IMarkTheme<IArcMarkSpec>;
}

export type LabelAutoVisibleType = {
  /**
   * 是否启用
   * @default false
   */
  enable?: boolean;

  /**
   * 周长阈值,扇区周长小于该值时, 则隐藏标签.
   * @default 10
   */
  circumference?: number;
};
