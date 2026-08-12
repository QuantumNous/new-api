import type { ITooltipLinePattern, ITooltipPattern, TooltipData, ITooltipLineActual, TooltipActualTitleContent } from '../../../typings/tooltip';
import type { TooltipHandlerParams } from '../interface/common';
export declare const getShowContent: (pattern: ITooltipPattern, data: TooltipData, params: TooltipHandlerParams) => TooltipActualTitleContent | null;
export declare const getOneLineData: (datum: any, config: ITooltipLinePattern, params: TooltipHandlerParams) => ITooltipLineActual;
