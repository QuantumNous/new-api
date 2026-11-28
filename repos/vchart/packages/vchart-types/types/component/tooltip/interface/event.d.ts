import type { TooltipActiveType, TooltipData } from '../../../typings';
import type { TooltipHandlerParams } from './common';
export type TooltipEventParams = TooltipHandlerParams & {
    activeType?: TooltipActiveType;
    tooltipData?: TooltipData;
    isEmptyTooltip?: boolean;
};
