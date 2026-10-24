import type { ITooltipHandlerOptions } from './interface';

export const TOOLTIP_PREFIX = 'vchart-tooltip';
export const TOOLTIP_CONTAINER_EL_CLASS_NAME = `${TOOLTIP_PREFIX}-container`;
export const TOOLTIP_TITLE_CLASS_NAME = `${TOOLTIP_PREFIX}-title`;
export const TOOLTIP_CONTENT_BOX_CLASS_NAME = `${TOOLTIP_PREFIX}-content-box`;
export const TOOLTIP_EMPTY_STRING = '';

export const DEFAULT_OPTIONS: ITooltipHandlerOptions = {
  /**
   * X offset.
   */
  offsetX: 10,

  /**
   * Y offset.
   */
  offsetY: 10
};
export const DEFAULT_TOOLTIP_Z_INDEX = '99999999999999';
