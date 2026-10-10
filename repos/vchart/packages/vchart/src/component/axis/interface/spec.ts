import type { AxisBreakProps, AxisItem, AxisItemStateStyle } from '@visactor/vrender-components';
import type { IAnimationSpec } from '../../../animation/spec';
import type {
  Datum,
  IFormatMethod,
  IPadding,
  IRectMarkSpec,
  IRichTextFormatMethod,
  IRuleMarkSpec,
  ISymbolMarkSpec,
  ITextMarkSpec,
  StringOrNumber
} from '../../../typings';
import type { IComponentSpec } from '../../base/interface';
import type { AxisType, IAxisItem, IBandAxisLayer, ITickCalculationCfg, StyleCallback } from './common';
import type { IBaseScale } from '@visactor/vscale';
import type { IVChart } from '../../../core';

export interface ICommonAxisSpec extends Omit<IComponentSpec, 'orient' | 'center'>, IAnimationSpec<string, string> {
  /**
   * 轴类型
   */
  type?: AxisType;
  /**
   * 是否显示坐标轴
   * @default true
   */
  visible?: boolean;
  /**
   * 是否开启反向坐标轴。
   * @default false
   */
  inverse?: boolean;
  /**
   * 轴刻度线配置
   */
  tick?: ITick;
  /**
   * 子刻度线配置
   */
  subTick?: ISubTick;

  /**
   * 是否开启动画，默认关闭
   * @default false
   */
  animation?: boolean;

  // 交互相关的配置
  /**
   * 是否开启 select 选中交互，默认关闭
   * @default false
   */
  select?: boolean;
  /**
   * 是否开启 hover 悬浮交互，默认关闭
   * @default false
   */
  hover?: boolean;

  /**
   * 是否开启轴数据采样，默认开启。
   * 轴采样开启之后，会对轴数据进行采样显示，防止轴数据的重叠。
   * 通过配置 `label.minGap` 可以控制轴标签之间的间距。
   * @default true
   * @since 1.1.0
   */
  sampling?: boolean;

  /**
   * 是否强制初始化 tick 数据，仅在 visible 为 false 时生效
   * @default false
   */
  forceInitTick?: boolean;
}

export type ILinearAxisBreakSpec = Omit<AxisBreakProps, 'rawRange'> & {
  /**
   * 截断标识之间的间距：
   * 1. `number` 为像素值
   * 2. `string` 为百分比相对值，如 '1%'
   * @default 6
   */
  gap?: number | string;
  /**
   * 计算截断对应range的类型，根据长度或者记录数进行分段
   * @since 1.12.12
   */
  scopeType?: 'count' | 'length';
};

export interface ILinearAxisSpec {
  // 线性轴数值范围配置
  /** 最小值，**优先级高于 zero，nice** */
  min?: number;
  /** 最大值，**优先级高于 zero，nice** */
  max?: number;

  /**
   * 最小值，当且仅当该值小于数据最小值时，才能生效
   * 注意：不建议和配置`min`一起使用
   * @since 1.11.0
   */
  softMin?: number | ((domain: number[]) => number);
  /**
   * 最大值，当且仅当该值大于数据最大值时，才能生效
   * 注意：不建议和配置`max`一起使用
   * @since 1.11.0
   */
  softMax?: number | ((domain: number[]) => number);

  /** @deparated 线性轴数值范围配置（已弃用，请使用外层 min/max） */
  range?: {
    /** @deparated 最小值 */
    min?: number;
    /** @deparated 最大值 */
    max?: number;
  };

  /**
   * 是否根据数据将轴范围调整到相对规整的数值
   * @default true
   * @description 当配置了 min 和 max，该配置项失效
   * @example 当配置了 max = 999, nice并不会将轴范围优化到1000
   */
  nice?: boolean;
  /**
   * nice效果的类型，是精度优先还是tickCount优先（比如tickCount为2那nice出来的精度就很低）
   * @default undefined('tickCountFirst')
   * @description 不配置就默认是tickCountFirst
   * @example 数据范围是0~6000，如果tickCount为2，那么tickCountFirst出来的range就是[0, 10000], accurateFirst出来的range就是[0, 6000]但10000显示不了
   */
  niceType?: 'tickCountFirst' | 'accurateFirst';
  /**
   * 是否包含0值
   * @default true
   * @description 当配置了 min和 max，该配置项失效
   */
  zero?: boolean;
  /**
   * 轴范围按比例扩展
   * @description 当配置了 min和 max，该配置项失效
   */
  expand?: {
    /**
     * 轴范围扩展的最小比例
     */
    min?: number;
    /**
     * 轴范围扩展的最大比例
     */
    max?: number;
  };

  /**
   * 连续轴上的 dimension tooltip 数据筛选范围
   * 如果配置为单个数字 d，则筛选区间为 [x0 - d, x0 + d]；如果配置为二元组 [d1, d2]，则筛选区间为 [x0 + d1, x0 + d2]
   * 如果配置为函数 f, 函数的返回值将会作为数据筛选范围的值
   * @since 1.4.0
   */
  tooltipFilterRange?: number | [number, number] | ((params: { scale: IBaseScale }) => number | [number, number]);
  /**
   * 轴截断配置，只对笛卡尔坐标系的 linear 轴生效
   * @since 1.12.4
   */
  breaks?: ILinearAxisBreakSpec[];
}

export interface IBandAxisSpec {
  /**
   * 是否去除 band 轴两端的留白，如果为 true，则两端的 padding 为 0，
   * **并且 bandPadding、paddingInner 和 paddingOuter 的设置将被忽略**。
   * @default false
   * @since 1.7.0
   */
  trimPadding?: boolean;
  /**
   * 同时设置轴的 paddingInner 和 paddingOuter
   * **因为有可能存在多层 scale( xField 设置成了数组，即分组场景），所以支持了数组类型，用于多层 scale 的 bandPadding 配置**
   */
  bandPadding?: number | number[];
  /**
   * band 轴的内边距
   * ** 因为有可能存在多层 scale( xField 设置成了数组，即分组场景），所以支持了数组类型，用于多层 scale 的 paddingInner 配置**
   * @default 0.1
   */
  paddingInner?: number | number[];
  /**
   * band 轴的外边距
   * ** 因为有可能存在多层 scale( xField 设置成了数组，即分组场景），所以支持了数组类型，用于多层 scale 的 paddingOuter 配置**
   * @default 0.3
   */
  paddingOuter?: number | number[];
  /**
   * 配置离散轴的数值范围
   * @since 1.1.0
   */
  domain?: StringOrNumber[];
  /**
   * `bandPosition` 是一个可选参数，用于指定数据点在 band 轴上的位置。它的含义是确定数据点在 band 轴上的位置偏移量，相对于 band 轴的起始位置。
   * `bandPosition` 的取值范围是从 0 到 1，其中 0 表示数据点位于 band 轴的起始位置，1 表示数据点位于 band 轴的结束位置。
   * @default 0.5
   */
  bandPosition?: number;

  /**
   * 当存在多层分组场景时，是否展示所有的分组轴
   * @default false
   * @since 1.9.0
   */
  showAllGroupLayers?: boolean;
  /**
   * 每一层轴的配置
   * layer[0] 为离坐标轴线最近的轴，当且仅当 `showAllGroupLayers` 配置开启生效。
   * @since 1.9.0
   */
  layers?: IBandAxisLayer[];
}
// Grid 配置项
export interface IGrid extends IAxisItem<IRuleMarkSpec> {
  /**
   * 两个栅格线间的填充色
   */
  alternateColor?: string | string[];
  /**
   * grid 是否与 label 对齐，默认为 true，即对齐，配置为 false 则显示在前后两个刻度中间
   * @default true
   */
  alignWithLabel?: boolean;
  /**
   * 网格线样式，支持回调
   */
  style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
  /**
   * 快捷属性，也可以在 `style` 中配置，用于配置网格线的绘制顺序，默认为 50
   * @default 50
   * @since 1.4.0
   */
  zIndex?: number;
}

// 刻度线配置
export interface ITick extends IAxisItem<IRuleMarkSpec>, ITickCalculationCfg {
  /**
   * Length of tick lines
   * 坐标轴刻度线的长度
   * @default 4
   */
  tickSize?: number;
  /**
   * 刻度线朝向，默认朝外(坐标线包围盒外部)
   * @default false
   */
  inside?: boolean;
  /**
   * tick 是否与 label 对齐，默认为 true，即对齐，配置为 false 则显示在前后两个刻度中间
   * @default true
   */
  alignWithLabel?: boolean;
  /**
   * 刻度线样式设置，支持回调
   */
  style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
  /**
   * 刻度线不同交互状态下的样式配置，支持：
   * 1. hover
   * 2. hover_reverse
   * 3. selected
   * 4. selected_reverse
   */
  state?: AxisItemStateStyle<IRuleMarkSpec>;
  /**
   * 用于 tick 的数据过滤
   * @since 1.1.0
   */
  dataFilter?: (data: AxisItem[], context: { vchart: IVChart }) => AxisItem[];
}

// 子刻度线配置
export interface ISubTick extends IAxisItem<IRuleMarkSpec> {
  /**
   * TODO: 考虑下 log 轴，自刻度线之间的间距是不均匀的问题
   * 子刻度个数
   */
  tickCount?: number;
  /**
   * 子刻度线朝向，默认朝外(坐标线包围盒外部)
   * @default false
   */
  inside?: boolean;
  /** 子刻度线的长度 */
  tickSize?: number;
  /**
   * 子刻度线不同交互状态下的样式配置，支持：
   * 1. hover
   * 2. hover_reverse
   * 3. selected
   * 4. selected_reverse
   */
  state?: AxisItemStateStyle<IRuleMarkSpec>;
}

// 轴标签配置
export interface ILabel extends IAxisItem<ITextMarkSpec> {
  /**
   * 文本类型
   * @deprecated 1.10.0 版本后，在 formatMethod 中返回 { type: 'rich', text: xxx}
   * */
  type?: 'text' | 'rich';
  /**
   * 轴标签内容格式化函数
   * @param text 原始标签文本值
   * @param datum 图形数据
   * @returns 格式化后的文本
   */
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>;
  /**
   * 格式化模板
   * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
   * @since 1.10.0
   */
  formatter?: string | string[];
  /** 标签同 tick 之间的间距 */
  space?: number;
  /**
   * 标签朝向，默认朝外(坐标线包围盒外部)
   * @default false
   */
  inside?: boolean;
  /**
   * 标签之间的最小间距（单位为像素），仅当轴采样开始时生效（`sampling: true`）。
   * 该配置会影响轴采样的结果。
   */
  minGap?: number;
  /**
   * 文本样式设置
   */
  style?: ITextMarkSpec | StyleCallback<ITextMarkSpec | undefined>;
  /**
   * label 不同交互状态下的样式配置，支持：
   * 1. hover
   * 2. hover_reverse
   * 3. selected
   * 4. selected_reverse
   */
  state?: AxisItemStateStyle<ITextMarkSpec>;
  /**
   * 用于 label 的数据过滤
   * @since 1.1.0
   */
  dataFilter?: (data: AxisItem[], layer: number, context: { vchart: IVChart }) => AxisItem[];
}

// 轴线配置
export interface IDomainLine extends IAxisItem<IRuleMarkSpec> {
  /**
   * domainLine 在不同交互状态下的样式配置，支持：
   * 1. hover
   * 2. hover_reverse
   * 3. selected
   * 4. selected_reverse
   */
  state?: AxisItemStateStyle<IRuleMarkSpec>;
}

// 轴标题配置
export interface ITitle extends IAxisItem<ITextMarkSpec> {
  /**
   * 文本类型
   * @deprecated 1.10.0 版本后，在 formatMethod 中返回 { type: 'rich', text: xxx}
   * */
  type?: 'text' | 'rich';
  /**
   * 轴标题内容，支持多种格式
   * - 字符串或者数值
   * - 字符串或者数值数组
   */
  text?: ITextMarkSpec['text'] | ReturnType<IRichTextFormatMethod<[]>>;
  /**
   * 标题的显示位置，直角坐标系默认 'middle'；
   * 极坐标系的圆弧轴如果配置了内半径，则默认 'middle'，否则 'end'
   */
  position?: 'start' | 'middle' | 'end';
  /**
   * 标题距离坐标轴(轴线、刻度、标签共同构成的包围盒)的距离
   */
  space?: number;
  /**
   * 标题内边距配置
   */
  padding?: IPadding | number | number[];
  /**
   * 标题背景色设置
   */
  background?: IAxisItem<IRectMarkSpec> & {
    /**
     * 背景的交互状态样式配置
     */
    state?: AxisItemStateStyle<Partial<IRectMarkSpec>>;
  };
  /**
   * TODO: 接入富文本
   * 标题 shape 配置
   */
  shape?: IAxisItem<ISymbolMarkSpec> & {
    /**
     * shape 同标题文本之间的间距
     */
    space?: number;
    /**
     * shape 标记的交互状态样式配置
     */
    state?: AxisItemStateStyle<Partial<ISymbolMarkSpec>>;
  };
  /**
   * 标题整体的旋转角度（如果标题配置了 background、shape 等属性的话，需要使用该属性进行整体的配置旋转）。
   */
  angle?: number;
  /**
   * text 文本的交互状态样式配置
   */
  state?: AxisItemStateStyle<Partial<ITextMarkSpec>>;
}
