import type { ITooltipHandlerSpec } from '../../component/tooltip/interface/spec';
import type { MaybeArray } from '../common';
import type { TooltipPatternProperty, TooltipUpdateCallback } from './common';
import type { TooltipActiveType, TooltipData } from './handler';
import type { ITooltipLineActual, ITooltipLinePattern } from './line';
import type { ITooltipPositionActual, TooltipPositionMode, TooltipPosition } from './position';
import type { ITooltipShapePattern } from './shape';

/**
 * 特定类型的的tooltip内容配置
 */
export interface ITooltipPattern extends ITooltipShapePattern {
  /**
   * 是否显示该类型的tooltip
   */
  visible?: TooltipPatternProperty<boolean>;
  /**
   * 特定类型的tooltip标题配置
   */
  title?: TooltipPatternProperty<ITooltipLinePattern>;
  /**
   * 特定类型的tooltip显示内容
   */
  content?: MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>;
  /**
   * 设置该类型的tooltip位置
   */
  position?: TooltipPatternProperty<TooltipPosition>;
  /**
   * 决定 `position` 相对固定于什么图形，如固定在鼠标指针周围或图元周围。该配置只有 `position` 设为字符串时生效。默认为 `'mark'`
   * @since 1.4.0
   */
  positionMode?: TooltipPatternProperty<TooltipPositionMode>;
  /**
   * 自定义更新 tooltip 标题的回调函数
   */
  updateTitle?: TooltipUpdateCallback<ITooltipLineActual>;
  /**
   * 自定义更新 tooltip 内容的回调函数
   */
  updateContent?: TooltipUpdateCallback<ITooltipLineActual[]>;
  /**
   * 自定义更新 tooltip 位置的回调函数
   */
  updatePosition?: TooltipUpdateCallback<ITooltipPositionActual>;

  /** tooltip content 保留的最大数据行数，默认为 20 */
  maxLineCount?: number;

  /**
   * tooltip content 保留最大数据行数后，代表“其他”的数据行内容
   */
  othersLine?: ITooltipLineActual;
  /**
   * 方便内部逻辑辨别 tooltip 类型，不暴露给用户
   */
  activeType?: TooltipActiveType;
}

export type GroupTooltipTriggerMark = 'line' | 'area' | 'point' | 'bar';

export interface IGroupTooltipPattern extends ITooltipPattern {
  /**
   * group tooltip 的触发 mark
   * @since 1.11.0
   */
  triggerMark?: MaybeArray<GroupTooltipTriggerMark>;
}

export interface ITooltipActual {
  visible?: boolean;
  title?: ITooltipLineActual;
  content?: ITooltipLineActual[];
  activeType?: TooltipActiveType;
  position?: ITooltipPositionActual;
  data?: TooltipData;
  handler?: Partial<ITooltipHandlerSpec>;
  maxLineCount?: number;
  updateTitle?: TooltipUpdateCallback<ITooltipLineActual>;
  updateContent?: TooltipUpdateCallback<ITooltipLineActual[]>;
  updatePosition?: TooltipUpdateCallback<ITooltipPositionActual>;
  othersLine?: ITooltipLineActual;
}
