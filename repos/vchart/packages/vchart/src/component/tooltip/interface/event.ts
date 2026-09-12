import type { TooltipActiveType, TooltipData } from '../../../typings';
import type { TooltipHandlerParams } from './common';

export type TooltipEventParams = TooltipHandlerParams & {
  /** 触发的 tooltip 类型 */
  activeType?: TooltipActiveType;
  /** tooltip 数据 */
  tooltipData?: TooltipData;
  /**
   * tooltip是否为空
   * @since 1.11.1
   */
  isEmptyTooltip?: boolean;
};
