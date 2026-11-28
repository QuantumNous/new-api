import type { BaseEventParams } from '../../../event/interface';
import type { TooltipActiveType } from '../../../typings';
import type { MarkTooltipInfo, MouseEventData } from './interface';
import { BaseTooltipProcessor } from './base';
export declare class MarkTooltipProcessor extends BaseTooltipProcessor {
    activeType: TooltipActiveType;
    showTooltip(info: MarkTooltipInfo, params: BaseEventParams, changePositionOnly: boolean): import("../interface").TooltipResult;
    getMouseEventData(params: BaseEventParams): MouseEventData;
}
export declare const registerMarkTooltipProcessor: () => void;
