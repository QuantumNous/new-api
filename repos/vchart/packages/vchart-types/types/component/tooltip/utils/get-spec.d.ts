import type { ITooltipActual, TooltipActiveType, TooltipData } from '../../../typings';
import type { ISeries } from '../../../series/interface';
import type { TooltipHandlerParams } from '../interface/common';
import type { ITooltipSpec } from '../interface/spec';
export declare const getTooltipSpecForShow: (activeType: TooltipActiveType, globalSpec: ITooltipSpec, series?: ISeries, data?: TooltipData, params?: TooltipHandlerParams) => ITooltipActual;
