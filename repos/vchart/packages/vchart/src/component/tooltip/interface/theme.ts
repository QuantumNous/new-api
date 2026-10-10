import type { ITextAttribute } from '@visactor/vrender-core';
import type { ILayoutNumber, ITooltipShapePattern, StringOrNumber, TextAlign, TextBaseLine } from '../../../typings';
import type { Padding } from '@visactor/vrender-components';
import type { ITokenKey } from '../../../theme/token/interface';
import type { ITooltipSpec } from './spec';

export interface ITooltipTextTheme<ColorType = string> {
  /**
   * 字体
   */
  fontFamily?: string;
  /**
   * 字体大小
   */
  fontSize?: number | ITokenKey;
  /**
   * 字体颜色
   */
  fill?: ColorType;
  /**
   * 字体颜色（兼容旧版本）
   * @deprecated
   */
  fontColor?: ColorType;
  /**
   * 字重
   */
  fontWeight?: StringOrNumber;
  /**
   * 对齐方式
   */
  textAlign?: TextAlign;
  /**
   * 字体基线
   */
  textBaseline?: TextBaseLine;
  /**
   * 行高
   */
  lineHeight?: number | string | ITokenKey;
  /**
   * 与相邻元素的水平间距
   */
  spacing?: number;
  /**
   * 是否支持换行
   */
  multiLine?: boolean;
  /**
   * 最大宽度
   */
  maxWidth?: number;
  /**
   * 换行模式，默认为'break-word'
   */
  wordBreak?: ITextAttribute['wordBreak'];
  /**
   * 是否开启自动宽度。效果分为以下几种情况：
   * - tooltip 标题：`autoWidth` 默认为 `false`。如果配置为 `true`，则 tooltip 标题会保持和 tooltip 内容一致的宽度
   * - tooltip key 标签：`autoWidth` 不适用
   * - tooltip value 标签：`autoWidth` 默认为 `true`。如果配置为 `true`，则 tooltip value 标签会自动占满 tooltip 整体宽度的剩余部分
   * @since 1.4.2
   */
  autoWidth?: boolean;
}

export interface ITooltipTheme<ColorType = string> {
  /** 容器样式配置 */
  panel?: {
    /** tooltip 容器内边距 */
    padding?: Padding;
    /** 背景色 */
    backgroundColor?: ColorType;
    /** tooltip边框 */
    border?: {
      color?: ColorType;
      width?: number;
      /** 圆角 */
      radius?: number;
    };
    /** tooltip阴影 */
    shadow?: {
      x: number;
      y: number;
      blur: number;
      spread: number;
      color: ColorType;
    };
  };
  /**
   * 设置 tooltip 中 shape 的样式
   */
  shape?: {
    /** 标记大小 */
    size?: number;
    /** shape 与相邻元素的水平间距 */
    spacing?: number;
  } & Omit<ITooltipShapePattern, 'seriesId'>;
  /** tooltip标题 */
  titleLabel?: ITooltipTextTheme<ColorType>;
  /** tooltip内容，key字段 */
  keyLabel?: Omit<ITooltipTextTheme<ColorType>, 'autoWidth'>;
  /** tooltip内容，value字段 */
  valueLabel?: ITooltipTextTheme<ColorType>;
  /** 内容项行间距 */
  spaceRow?: number;
  /**
   * 最大内容区高度，内容区若超过该高度将显示局部滚动条（适用于 dom tooltip）
   * @since 1.9.0
   * @since 1.13.0 支持百分比的高度，当配置为百分比的时候，会根据图表的高度，body的最大高度，计算出来一个相对高度
   */
  maxContentHeight?: ILayoutNumber;
  /** 偏移量 */
  offset?: {
    x?: number;
    y?: number;
  };
  /**
   * 浮层移动动画过渡时间，单位是 ms，设置为 0 的时候会紧跟着鼠标移动（目前仅影响 dom tooltip）
   * @since 1.11.9
   */
  transitionDuration?: number;
  /**
   * shape、key、value的对齐方式，可选项如下：
   * 'left': 从左到右对齐
   * 'right': 从右到左对齐
   * @since 1.11.5
   */
  align?: 'left' | 'right';
  /**
   * tooltip触发方式
   * （*会影响自定义handler）
   */
  trigger?: ITooltipSpec['trigger'];
  /**
   * 隐藏tooltip的触发方式（目前仅支持和trigger一致的设置以及none）
   * （*会影响自定义handler）
   */
  triggerOff?: ITooltipSpec['triggerOff'];
}
