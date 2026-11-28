import type { IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec } from '../../../typings/visual';
import type {
  DiscreteLegendAttrs,
  LegendItemDatum,
  LegendItem,
  LegendPagerAttributes,
  LegendScrollbarAttributes
} from '@visactor/vrender-components';
import type { ILegendCommonSpec, NoVisibleMarkStyle } from '../interface';
import type { IFormatMethod, StringOrNumber } from '../../../typings';
import type { ILayoutRect } from '../../../typings/layout';
import type { IOrientType } from '../../../typings/space';
import type { IBaseScale } from '@visactor/vscale';
import type { IGlobalScale } from '../../../scale/interface';
import type { ComponentThemeWithDirection } from '../../interface';

// export type formatterCallback = (text: StringOrNumber, item: LegendItemDatum, index: number) => any;
export type formatterCallback = IFormatMethod<[text: StringOrNumber, item: LegendItemDatum, index: number]>;
export type LegendItemStyleValue<T> =
  | T
  | ((item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) => T);
export type LegendItemStyle<T> = {
  /**
   * 样式配置
   */
  style?: T;
  /**
   * 状态样式配置
   */
  state?: {
    /**
     * 选中态
     */
    selected?: T;
    /**
     * 非选中态
     */
    unSelected?: T;
    /**
     * 选中态 hover
     */
    selectedHover?: T;
    /**
     * 非选中态 hover
     */
    unSelectedHover?: T;
  };
};

export type IItem = {
  /**
   * @since 1.10.0
   * 指定图例项中图标和文字的摆放位置，可选值为：
   * 'left' 图标在左侧
   * 'right' 图标在右侧
   * 默认值为： 'left'
   */
  align?: 'left' | 'right';
  /**
   * 图例项背景配置
   */
  background?: {
    /**
     * 是否展示图例项背景
     */
    visible?: boolean;
  } & LegendItemStyle<LegendItemStyleValue<NoVisibleMarkStyle<IRectMarkSpec>>>;
  /**
   * 图例项的 shape 图标的配置
   */
  shape?: {
    /**
     * 图例项的 shape 图标
     */
    visible?: boolean;
    /** shape 同后面 label 的间距 */
    space?: number;
  } & LegendItemStyle<LegendItemStyleValue<Partial<NoVisibleMarkStyle<ISymbolMarkSpec>>>>;
  /**
   * 图例项的 label 文本配置
   */
  label?: {
    /**
     * @since 1.10.0
     * 当 label + value 同时展示，文字超长的时候，label的宽度占比
     */
    widthRatio?: number;
    /**
     * 图例项 label 同后面 value 的间距
     */
    space?: number;
    /**
     * 格式化文本函数
     */
    formatMethod?: formatterCallback;
    /**
     * 格式化模板
     * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
     * @since 1.10.0
     */
    formatter?: string;
  } & LegendItemStyle<LegendItemStyleValue<NoVisibleMarkStyle<ITextMarkSpec>>>;
  /**
   * 图例项 value 配置
   */
  value?: {
    /**
     * @since 1.10.0
     * 当 label + value 同时展示，文字超长的时候，label的宽度占比
     */
    widthRatio?: number;
    /** value 同后面元素的间距 */
    space?: number;
    /**
     * 是否右对齐显示，仅当设置图例项宽度 itemWidth 时生效
     * 默认为 false，
     */
    alignRight?: boolean;
    /**
     * 格式化文本函数
     */
    formatMethod?: formatterCallback;
    /**
     * 格式化模板
     * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
     * @since 1.10.0
     */
    formatter?: string | string[];
  } & LegendItemStyle<LegendItemStyleValue<NoVisibleMarkStyle<ITextMarkSpec>>>;
  /**
   * 聚焦按钮配置
   */
  focusIconStyle?: NoVisibleMarkStyle<ISymbolMarkSpec>;
  /**
   * 图例项的最大宽度，默认为 null。
   * 可使用百分比，表示显示区域的宽度占比。
   */
  maxWidth?: number | string;
  /**
   * 图例项的宽度, 默认自动计算。
   * 可使用百分比，表示显示区域的宽度占比。
   */
  width?: number | string;
  /**
   * 图例的高度，默认自动计算。
   * 可使用百分比，表示显示区域的高度占比。
   */
  height?: number | string;
  /**
   * @since 1.10.0
   * 当label+ value同时存在的时候，自动省略的策略
   * 'labelFirst' - 尽量保证完整展示`label`
   * 'valueFirst' - 尽量保证完整展示`value`
   * 'none' - 按照`widthRatio`展示label 和 value
   */
  autoEllipsisStrategy?: 'labelFirst' | 'valueFirst' | 'none';
} & Omit<LegendItem, 'background' | 'shape' | 'label' | 'value' | 'focusIconStyle' | 'width' | 'height' | 'maxWidth'>;

export type IPager = {
  /**
   * 文本样式配置
   */
  textStyle?: Partial<NoVisibleMarkStyle<ITextMarkSpec>>;
  handler?: {
    /**
     * 按钮同文本内容区的间距，默认为 8
     */
    space?: number;
    /**
     * 上一页按钮形状
     */
    preShape?: string;
    /**
     * 下一页按钮形状
     */
    nextShape?: string;
    style?: Omit<NoVisibleMarkStyle<ISymbolMarkSpec>, 'symbolType'>;
    state?: {
      /**
       * hover 状态下的样式
       */
      hover?: Omit<NoVisibleMarkStyle<ISymbolMarkSpec>, 'symbolType'>;
      /**
       * 不可用状态样式
       */
      disable?: Omit<NoVisibleMarkStyle<ISymbolMarkSpec>, 'symbolType'>;
    };
  };
} & Omit<LegendPagerAttributes, 'textStyle' | 'handler'>;

export type ILegendScrollbar = {
  type: 'scrollbar';
  railStyle?: Omit<Partial<NoVisibleMarkStyle<IRectMarkSpec>>, 'width' | 'height'>;
  sliderStyle?: Omit<Partial<NoVisibleMarkStyle<IRectMarkSpec>>, 'width' | 'height'>;
} & Omit<LegendScrollbarAttributes, 'railStyle' | 'sliderStyle'>;

/** spec */
/**
 * The layout context passed to a `maxRow` / `maxCol` callback. The callback is evaluated during
 * layout, so the row / column count can be derived from the space actually allocated to the legend.
 * @since 2.0.23
 */
export interface IDiscreteLegendArrangeContext {
  /** the layout rect allocated to the legend in the current layout */
  rect: ILayoutRect;
  /** the resolved orient the legend lays out with (defaults to `'left'` when `spec.orient` is unset) */
  orient: IOrientType;
  /** the id of the legend */
  id?: StringOrNumber;
}

/**
 * The max row / col count of a discrete legend. Either a fixed number, or a callback that returns a
 * number, evaluated during layout against {@link IDiscreteLegendArrangeContext}.
 */
export type DiscreteLegendArrangeCount = number | ((ctx: IDiscreteLegendArrangeContext) => number);

export type IDiscreteLegendSpec = ILegendCommonSpec & {
  type?: 'discrete';
  /**
   * 在原始图例绘制数据的基础上，进行自定义，比如可以自定义 value 值
   * @param data 图例的绘制数据
   * @param colorScale 全局颜色映射 scale
   * @param globalScale 图表上所有的 scale
   * @returns
   */
  data?: (data: LegendItemDatum[], colorScale: IBaseScale, globalScale: IGlobalScale) => LegendItemDatum[];

  /** 图例项配置 */
  item?: IItem;

  /**
   * 翻页器配置
   */
  pager?: IPager | ILegendScrollbar;
  /**
   * scale must match the id of the scale configured in **scales**
   * 离散图例对应的scale
   * @since 1.10.5
   */
  scale?: string;
  /**
   * 同`scale`，为了和连续图例保持一致，建议统一为`scale`
   */
  scaleName?: string;
  /**
   * After the legend is bound to the scale, the dimension associated with the series data and the legend can be configured through field.
   * If the field is not configured, the first item of fields in the domain of scale is used by default
   * If the domain of the scale is not dependent on data statistics, series.getSeriesField() is used by default
   */
  field?: string;
  /**
   * 默认筛选的数据范围
   */
  defaultSelected?: string[];
  /**
   * The maximum number of rows displayed (for horizontal legend). Besides a fixed number, a
   * callback `(ctx) => number` is also supported, which is evaluated during layout so the row
   * count can adapt to the space allocated to the legend.
   * @since 2.0.23
   */
  maxRow?: DiscreteLegendArrangeCount;
  /**
   * The maximum number of columns displayed (for vertical legend). Besides a fixed number, a
   * callback `(ctx) => number` is also supported (see {@link maxRow}).
   * @since 2.0.23
   */
  maxCol?: DiscreteLegendArrangeCount;
} & Omit<DiscreteLegendAttrs, 'layout' | 'title' | 'items' | 'item' | 'pager' | 'maxRow' | 'maxCol'>;

// theme 主题相关配置
export type IDiscreteLegendCommonTheme = Omit<
  IDiscreteLegendSpec,
  'type' | 'data' | 'regionIndex' | 'regionId' | 'seriesIndex' | 'seriesId' | 'id' | 'defaultSelected'
>;

export type IDiscreteLegendTheme = ComponentThemeWithDirection<IDiscreteLegendCommonTheme>;
