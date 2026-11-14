import type { LegendTitle } from '@visactor/vrender-components';
import type {
  Datum,
  IOrientType,
  IPadding,
  IRectMarkSpec,
  ISymbolMarkSpec,
  ITextMarkSpec,
  StringOrNumber
} from '../../typings';
import type { IComponent } from '../interface';
import type { IComponentSpec } from '../base/interface';
import type { IDiscreteLegendSpec } from './discrete/interface';
import type { IColorLegendSpec, ISizeLegendSpec } from './continuous/interface';

export type ILegend = IComponent & {
  getLegendData: () => Datum[];
  getSelectedData: () => StringOrNumber[];
  setSelectedData: (d: StringOrNumber[]) => void;
};

export interface IDiscreteLegend extends ILegend {
  getLegendDefaultData: (originalData?: boolean) => StringOrNumber[];
}

export type NoVisibleMarkStyle<T> = Omit<T, 'visible'>;

export type ITitle = {
  /** 标题文本样式 */
  textStyle?: NoVisibleMarkStyle<ITextMarkSpec>;
  /**
   * @deprecated 请使用 textStyle 配置文本样式
   */
  style?: NoVisibleMarkStyle<ITextMarkSpec>;
  /** 文本前 mark 图元 */
  shape?: {
    /**
     * 是否展示 shape
     */
    visible?: boolean;
    /**
     * shape 同 文本的间距
     */
    space?: number;
    style?: NoVisibleMarkStyle<ISymbolMarkSpec>;
  };
  /**
   * 标题的背景面板配置
   */
  background?: {
    /**
     * 是否绘制背景层
     */
    visible?: boolean;
    /**
     * 背景层样式
     */
    style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'visible' | 'width' | 'height'>;
  };
} & Omit<LegendTitle, 'textStyle' | 'style' | 'background'>;

// 图例组件通用配置
export type ILegendCommonSpec = {
  /**
   * 是否显示图例
   * @default true
   */
  visible?: boolean;
  /**
   * 图例的位置，相对于region区域的四个方位，
   * left - 图例在左侧
   * right - 图例在右侧
   * top - 图例在上方
   * bottom - 图例在下方
   * @default 'left'
   */
  orient?: IOrientType;
  /**
   * 图例在当前行或者列的对齐方式，起始 | 居中 | 末尾，
   * 对于orient为'left'或者'right'的图例，
   * start - 图例在左侧
   * middle - 图例居中
   * end - 图例在右侧
   * 对于orient为'top'或者'bottom'的图例，
   * start - 图例在上方
   * middle - 图例居中
   * end - 图例在下方
   * @default 'middle'
   */
  position?: 'start' | 'middle' | 'end';
  /**
   * 图例组件的布局配置，默认自动跟随显示位置进行调整。
   * 1. `orient` 为 'top' 或者 'bottom' 时，默认为 'horizontal' 水平布局
   * 2. `orient` 为 'left' 或者 'right' 时，默认为 'vertical' 垂直布局
   */
  layout?: 'horizontal' | 'vertical';

  /**
   * 是否进行数据筛选，默认为 true
   */
  filter?: boolean;
  /**
   * 自定义筛选函数
   * @since 1.13.1
   * @param data 当前数据
   * @param selectedRange 选中的数据范围
   * @param datumField 筛选数据对应的字段
   * @returns 最终展示的数据
   */
  customFilter?: (data: any, selectedRange: StringOrNumber[], datumField: string) => any;

  /**
   * 图例标题配置
   */
  title?: ITitle;

  /**
   * 图例背景配置
   */
  background?: {
    /**
     * 是否绘制背景层
     */
    visible?: boolean;
    /**
     * 背景内边距
     */
    padding?: IPadding | number | number[];
    /**
     * 背景层样式
     */
    style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'visible' | 'width' | 'height'>;
  };
  /**
   * 是否允许交互
   * @default true
   */
  interactive?: boolean;
} & Omit<IComponentSpec, 'orient'>;

export type ILegendSpec = IDiscreteLegendSpec | IColorLegendSpec | ISizeLegendSpec;
