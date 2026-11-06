import type { TooltipContentProperty } from './common';
import type { ITooltipLabelActual, ITooltipLabelPattern } from './label';
import type { ITooltipShapeActual, ITooltipShapePattern } from './shape';
import type { TooltipRichTextAttrs } from '@visactor/vrender-components';

export interface ITooltipLinePattern extends ITooltipShapePattern, ITooltipLabelPattern {
  /** tooltip key 值内容 */
  key?: TooltipContentProperty<string>;
  /**
   * 格式化模板
   * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
   * @since 1.10.0
   */
  keyFormatter?: string;
  /** tooltip value 值内容
   *  支持富文本配置
   *   - type 文本类型：text, rich
   *   - text 文本内容：string | string[] | number | number[] | IRichTextCharacter[];
   */
  value?: TooltipContentProperty<string | TooltipRichTextAttrs>;
  /**
   * 格式化模板
   * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
   * @since 1.10.0
   */
  valueFormatter?: string;

  /**
   * 该行是否可见
   */
  visible?: TooltipContentProperty<boolean>;
  /**
   * key 列是否适应内容
   */
  isKeyAdaptive?: TooltipContentProperty<boolean>;
  /**
   * 该行行间距
   * @since 1.4.0
   */
  spaceRow?: TooltipContentProperty<number>;
  /**
   * 如果配置了该值，则 key 字段的最终值会自动格式化为时间字符串
   * @since 1.9.0
   */
  keyTimeFormat?: string;
  /**
   * key值时间格式的模式，支持两种模式：
   * - utc：表示时间是 UTC 时间
   * - local：表示时间是本地时间
   */
  keyTimeFormatMode?: 'utc' | 'local';
  /**
   * 如果配置了该值，则 value 字段的最终值会自动格式化为时间字符串
   * @since 1.9.0
   */
  valueTimeFormat?: string;
  /**
   * value值时间格式的模式，支持两种模式：
   * - utc：表示时间是 UTC 时间
   * - local：表示时间是本地时间
   */
  valueTimeFormatMode?: 'utc' | 'local';
}

export interface ITooltipLineActual extends ITooltipShapeActual, ITooltipLabelActual {
  /**
   * tooltip key 值内容
   */
  key?: string;
  /**
   * tooltip value 值内容
   */
  value?: string | TooltipRichTextAttrs;
  /**
   * tooltip value 的格式化模板
   */
  valueFormatter?: string;
  /**
   * 该行是否可见
   */
  visible?: boolean;
  /**
   * key 列是否适应内容
   */
  isKeyAdaptive?: boolean;
  /**
   * 该行行间距
   * @since 1.4.0
   */
  spaceRow?: number;
  /**
   * 该行对应的原始数据
   * @since 1.5.1
   */
  datum?: any;
}

export type TooltipActualTitleContent = {
  /**
   * tooltip标题内容
   */
  title?: ITooltipLineActual;
  /**
   * tooltip内容
   */
  content?: ITooltipLineActual[];
};
