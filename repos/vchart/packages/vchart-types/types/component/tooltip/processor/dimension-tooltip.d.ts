import type { BaseEventParams } from '../../../event/interface';
import type { TooltipActiveType } from '../../../typings';
import type { DimensionTooltipInfo, MouseEventData } from './interface';
import { BaseTooltipProcessor } from './base';
import type { IDimensionInfo } from '../../../event/events/dimension/interface';
export declare class DimensionTooltipProcessor extends BaseTooltipProcessor {
    activeType: TooltipActiveType;
    showTooltip(info: DimensionTooltipInfo, params: BaseEventParams, changePositionOnly: boolean): import("../interface").TooltipResult;
    protected _getDimensionInfo(params: BaseEventParams): IDimensionInfo[];
    getMouseEventData(params: BaseEventParams): MouseEventData;
}
export declare const registerDimensionTooltipProcessor: () => void;
