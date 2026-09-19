import { PREFIX } from '../../constant/base';
import type { ITooltipLineActual } from '../../typings';

export const TooltipHandlerType = {
  dom: `${PREFIX}_TOOLTIP_HANDLER_DOM`, // 模拟 enum
  canvas: `${PREFIX}_TOOLTIP_HANDLER_CANVAS`
};

export const TOOLTIP_EL_CLASS_NAME = 'vchart-tooltip-element';

export const TOOLTIP_MAX_LINE_COUNT = 20;

export const TOOLTIP_OTHERS_LINE = {
  // TODO: i18n
  key: '其他',
  value: '...'
} as ITooltipLineActual;

export const enum TooltipType {
  group = 'group',
  mark = 'mark',
  dimension = 'dimension'
}

export const DEFAULT_SHOW_DELAY = 50;
