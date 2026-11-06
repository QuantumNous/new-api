import type { IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec, StringOrNumber } from '../../../typings';
import type { ComponentThemeWithDirection } from '../../interface';
import type { ILegendCommonSpec, NoVisibleMarkStyle } from '../interface';
import type { HandlerTextStyleContext } from '@visactor/vrender-components';

type Text = StringOrNumber;
type ContinuousLegendTextStyle = Omit<NoVisibleMarkStyle<ITextMarkSpec>, 'text'>;
type ContinuousLegendTextStyleCallback = (
  value: Text,
  position: 'start' | 'end',
  context: HandlerTextStyleContext
) => ContinuousLegendTextStyle | undefined;

export type TextAttribute = {
  /** 是否展示 */
  visible?: boolean;
  /** 文本内容 */
  text?: Text;
  /**
   * 文本同滑块的间距，默认为 6
   */
  space?: number;
  /**
   * 文本样式
   */
  style?: ContinuousLegendTextStyle;
};

export type HandlerTextAttribute = {
  /** 是否展示 */
  visible?: boolean;
  /**
   * 数据展示的小数精度，默认为0，无小数点。
   */
  precision?: number;
  /** 文本内容格式化函数 */
  formatter?: (text: Text) => Text;
  /**
   * 文本同滑块的间距，默认为 6
   */
  space?: number;
  /**
   * 文本样式
   */
  style?: ContinuousLegendTextStyle | ContinuousLegendTextStyleCallback;
};

// 连续图例通用配置
export type IContinuousLegendSpec = ILegendCommonSpec & {
  /**
   * 连续图例是否开启反向展示，最小值和最大值会发生反向
   * @default false
   * @since 1.11.0
   */
  inverse?: boolean;
  /**
   * 声明关联的映射字段
   */
  field?: string;
  /**
   * 连续图例关联的映射 scale
   */
  scale?: string;
  /**
   * 默认筛选的数据范围
   */
  defaultSelected?: [number, number];
  /**
   * 是否允许拖动，默认为 true
   */
  slidable?: boolean;
  /**
   * 滑块轨道配置
   */
  rail?: {
    /**
     * 滑块的宽度
     */
    width?: number;
    /**
     * 滑块的高度
     */
    height?: number;
    /**
     * 背景轨道样式配置
     */
    style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'width' | 'height'>;
  };
  /**
   * 滑块手柄配置
   */
  handler?: {
    /**
     * 是否绘制 handler，默认为 true
     */
    visible?: boolean;
    /**
     * 滑块手柄的样式配置
     */
    style?: NoVisibleMarkStyle<ISymbolMarkSpec>;
  };
  /**
   * 选中区域样式配置
   */
  track?: {
    style?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'width' | 'height'>;
  };
  /**
   * 滑块首部文本配置
   */
  startText?: TextAttribute;
  /**
   * 滑块尾部文本配置
   */
  endText?: TextAttribute;
  /**
   * 滑块对应的文本配置项
   */
  handlerText?: HandlerTextAttribute;
};

// 颜色图例配置
export type IColorLegendSpec = IContinuousLegendSpec & {
  /**
   * 声明 color 类型图例
   */
  type: 'color';
};

// 尺寸图例配置
export type ISizeLegendSpec = IContinuousLegendSpec & {
  /**
   * 声明 size 类型图例
   */
  type: 'size';
  /**
   * size 背景样式配置
   */
  sizeBackground?: Omit<NoVisibleMarkStyle<IRectMarkSpec>, 'visible' | 'width' | 'height'>;
  /**
   * 指定组件中手柄和文字的摆放位置，可选值为：
   * 'left' 手柄和label在滑块左侧，layout 为 vertical 时有效。
   * 'right' 手柄和label在滑块右侧，layout 为 vertical 时有效。
   * 'top' 手柄和label在滑块上侧，layout 为 horizontal 时有效。
   * 'bottom' 手柄和label在滑块下侧，layout 为 horizontal 时有效。
   */
  align?: 'top' | 'bottom' | 'left' | 'right';
};

export type IContinuousLegendTheme = Omit<
  IContinuousLegendSpec,
  'type' | 'field' | 'scale' | 'regionIndex' | 'regionId' | 'seriesIndex' | 'seriesId' | 'id' | 'defaultSelected'
>;

export type ISizeLegendCommonTheme = IContinuousLegendTheme & {
  sizeBackground?: ISizeLegendSpec['sizeBackground'];
};

export type IColorLegendTheme = ComponentThemeWithDirection<IContinuousLegendTheme>;

export type ISizeLegendTheme = ComponentThemeWithDirection<ISizeLegendCommonTheme>;
