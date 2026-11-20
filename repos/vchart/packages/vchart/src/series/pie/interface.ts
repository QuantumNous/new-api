import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IArcMarkSpec, ITextMarkSpec, ILineMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IPolarSeriesSpec, IPolarSeriesTheme } from '../polar/interface';
import type { ILabelSpec, IMultiLabelSpec } from '../../component/label/interface';
import type { ICustomPath2D, ILineGraphicAttribute, ITextGraphicAttribute } from '@visactor/vrender-core';
import type { ILayoutRect, IPercent } from '../../typings/layout';
import type { IPointLike } from '@visactor/vutils';
import type { AnimationStateEnum } from '../../animation/interface';
import type { Datum } from '../../typings/common';
import type { IMarkGraphic } from '../../mark/interface';

export interface IPieAnimationParams {
  growField?: 'angle' | 'radius';
  growFrom: (datum: Datum, g: IMarkGraphic, state: AnimationStateEnum) => number;
}

export type PieAppearPreset = 'growAngle' | 'growRadius' | 'fadeIn';

export type PieMarks = 'pie' | 'label' | 'labelLine';

export type IBasePieSeriesSpec = Omit<IPieSeriesSpec, 'type'> & { type: string };

export interface IPieSeriesSpec extends IPolarSeriesSpec, IAnimationSpec<PieMarks, PieAppearPreset> {
  type: 'pie';
  /**
   * 分类字段
   * @description 饼图每个扇区为独立的系列
   */
  categoryField: string;
  /** 数值字段 */
  valueField: string;
  /** 饼图中心点 x 坐标 */
  centerX?: number | IPercent;
  /** 饼图中心点 y 坐标 */
  centerY?: number | IPercent;
  /** 饼图扇区中心偏移 */
  centerOffset?: number;

  /**
   * 饼图扇区半径
   * @default 0.6
   * @deprecated use outerRadius instead
   */
  radius?: number;

  /**
   * 饼图扇区外半径
   * @default 0.6
   */
  outerRadius?: number;

  /**
   * 饼图扇区内半径
   * @default 0
   */
  innerRadius?: number;

  /**
   * 饼图扇区圆角半径
   * @default 0
   */
  cornerRadius?: number;
  /**
   * 饼图的起始角度（0 ~ 360）
   * @default -90
   */
  startAngle?: number;
  /**
   * 饼图的结束角度（0 ~ 360）
   * @default 270
   */
  endAngle?: number;
  /**
   * 扇区之间的间隔角度
   */
  padAngle?: number;

  /**
   * 最小的扇区角度（0 ~ 360），用于防止某个值过小导致扇区太小影响交互。
   * @default 0
   * @since 1.4.0
   */
  minAngle?: number;

  /**
   * @since 1.11.12
   */
  layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);

  /** 扇区样式 */
  [SeriesMarkNameEnum.pie]?: IMarkSpec<IArcMarkSpec>;
  /** 标签配置 */
  [SeriesMarkNameEnum.label]?: IMultiLabelSpec<IArcLabelSpec>;

  /** 数据为空时显示的占位图形 */
  emptyPlaceholder?: {
    /** 是否显示占位圆
     * @default false
     */
    showEmptyCircle?: boolean;

    /** 占位圆样式 */
    emptyCircle?: IMarkSpec<IArcMarkSpec>;
  };

  /**
   * 是否在数据均为0时显示均分扇区。
   * @default false
   */
  showAllZero?: boolean;

  /**
   * 是否将负数按照绝对值进行处理。
   * @default false
   */
  supportNegative?: boolean;
}

export interface IPieSeriesTheme extends IPolarSeriesTheme {
  [SeriesMarkNameEnum.pie]?: Partial<IMarkTheme<IArcMarkSpec>>;
  /** 标签配置 */
  [SeriesMarkNameEnum.label]?: IArcLabelSpec;
  /**
   * 内标签配置
   * @since 1.5.1
   */
  innerLabel?: IArcLabelSpec;
  /**
   * 外标签配置
   * @since 1.5.1
   */
  outerLabel?: IArcLabelSpec;
  /** 数据为空时显示的占位圆样式
   * @since 1.12.0
   */
  emptyCircle?: Partial<IMarkTheme<IArcMarkSpec>>;
}

export interface IArcLabelLineSpec extends Omit<IMarkSpec<ILineMarkSpec>, 'customShape'> {
  /**
   * 是否显示引导线
   * @default true
   */
  visible?: boolean;
  /**
   * 引导线 line1 部分最小长度
   * @default 20
   */
  line1MinLength?: number;
  /**
   * 引导线 line2 部分最小长度
   * @default 10
   */
  line2MinLength?: number;
  /**
   * 引导线是否光滑
   * @default false
   * @since 1.4.0
   */
  smooth?: boolean;
  /**
   * 标签引导线支持自定义path
   * @since 1.11.11
   */
  customShape?: (
    text: ITextGraphicAttribute,
    attrs: Partial<ILineGraphicAttribute>,
    path: ICustomPath2D
  ) => ICustomPath2D;
}

export type ArcLabelAlignType = 'arc' | 'labelLine' | 'edge';

export type ArcLabelStrategyType = 'priority' | 'vertical' | 'none';

export interface IArcLabelLayoutSpec {
  /**
   * 标签对齐方式
   * @default 'arc'
   */
  textAlign?: ArcLabelAlignType;
  /** @deprecate 建议统一使用textAlign，后续将废除 */
  align?: ArcLabelAlignType;
  /**
   * 标签布局策略
   * @default 'priority'
   */
  strategy?: ArcLabelStrategyType;
  /**
   * 是否启用切线约束
   * @default true
   */
  tangentConstraint?: boolean;
}

export type IArcLabelSpec = Omit<ILabelSpec, 'position'> & {
  /**
   * 标签布局方式
   * @default 'outside'
   */
  position?: 'outside' | 'inside' | 'inside-center';
  /**
   * 标签内容显示规则
   * @default 'all'
   */
  showRule?: 'all' | 'max' | 'min' | 'minAndMax' | 'headAndTail';
  /**
   * 是否允许标签重叠
   * @default false
   */
  coverEnable?: boolean;
  /**
   * 是否允许标签旋转
   * @default true
   */
  rotate?: boolean;

  /**
   * 文字与引导线间隔宽度
   * @default 5
   */
  spaceWidth?: number;
  /**
   * 扇区间标签的间隔
   * @default 6
   */
  layoutArcGap?: number;
  /** 中心点偏移距离 */
  centerOffset?: number;
  /** 标签文字样式 */
  style?: ITextMarkSpec;
  /** 标签引导线样式 */
  line?: IArcLabelLineSpec;
  /** 标签布局配置 */
  layout?: IArcLabelLayoutSpec;
};
